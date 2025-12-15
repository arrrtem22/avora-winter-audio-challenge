import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseAudioOptions {
  /**
   * Optional pre-configured AnalyserNode. If provided, the hook will use this
   * analyser and its AudioContext. The caller is responsible for the analyser's
   * lifecycle - it won't be disconnected or have its context closed on stop().
   *
   * If not provided, a default AnalyserNode is created with fftSize=2048.
   */
  analyserNode?: AnalyserNode
}

export interface UseAudioReturn {
  /** Ref containing FFT frequency data (0-255 values). Updated in-place every frame. */
  frequencyData: React.RefObject<Uint8Array<ArrayBuffer>>
  /** Ref containing time-domain waveform data (0-255 values). Updated in-place every frame. */
  timeDomainData: React.RefObject<Uint8Array<ArrayBuffer>>
  /** Whether the microphone is active and streaming */
  isActive: boolean
  /** Error message if mic permission denied or unavailable */
  error: string | null
  /** Start microphone capture */
  start: () => Promise<void>
  /** Stop microphone capture */
  stop: () => void
}

const DEFAULT_FFT_SIZE = 2048

/**
 * useAudio - A stable hook for accessing microphone audio data
 *
 * Returns refs that are updated in-place every frame. Consumers should
 * run their own requestAnimationFrame loop to read the data.
 *
 * DO NOT MODIFY THIS FILE - This is the stable audio pipeline for the challenge.
 * Modify src/visualizers/Visualizer.tsx instead.
 */
export function useAudio({ analyserNode }: UseAudioOptions = {}): UseAudioReturn {
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Audio data buffers - updated in-place, no React re-renders
  const frequencyData = useRef(new Uint8Array(DEFAULT_FFT_SIZE / 2))
  const timeDomainData = useRef(new Uint8Array(DEFAULT_FFT_SIZE))

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Track if user provided the analyser (we don't own it, don't clean it up)
  const userProvidedAnalyserRef = useRef(false)

  // Track mounted state to prevent setState after unmount
  const mountedRef = useRef(true)

  // Session counter for StrictMode safety - prevents stale async operations
  const sessionRef = useRef(0)

  const stop = useCallback(() => {
    // Increment session to invalidate any pending async operations
    sessionRef.current++

    // Always cleanup animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Always cleanup stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Always cleanup source (we always create it)
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    // Only cleanup analyser/context if we own them
    if (!userProvidedAnalyserRef.current) {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      analyserRef.current = null
    }

    if (mountedRef.current) {
      setIsActive(false)
    }
  }, [])

  const start = useCallback(async () => {
    // Stop any existing session first
    stop()

    // Capture current session for async safety
    const currentSession = sessionRef.current

    try {
      if (mountedRef.current) {
        setError(null)
      }

      // Use provided analyser or create our own
      if (analyserNode) {
        userProvidedAnalyserRef.current = true
        analyserRef.current = analyserNode
        audioContextRef.current = analyserNode.context as AudioContext
      } else {
        userProvidedAnalyserRef.current = false
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = DEFAULT_FFT_SIZE
        analyserRef.current.smoothingTimeConstant = 0.8
      }

      // Allocate buffers sized to the analyser
      frequencyData.current = new Uint8Array(analyserRef.current.frequencyBinCount)
      timeDomainData.current = new Uint8Array(analyserRef.current.fftSize)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      // Check if session changed (stop() was called) or component unmounted
      if (currentSession !== sessionRef.current || !mountedRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      // Resume AudioContext - clicking "Allow" on mic prompt was the user gesture
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      streamRef.current = stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream)
      sourceRef.current.connect(analyserRef.current)

      setIsActive(true)

      // Animation loop - updates refs in-place, no React involvement
      const updateData = () => {
        if (!analyserRef.current || currentSession !== sessionRef.current) {
          return
        }

        analyserRef.current.getByteFrequencyData(frequencyData.current)
        analyserRef.current.getByteTimeDomainData(timeDomainData.current)

        animationFrameRef.current = requestAnimationFrame(updateData)
      }

      updateData()
    } catch (err) {
      if (!mountedRef.current || currentSession !== sessionRef.current) return

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found')
        } else {
          setError(err.message)
        }
      } else {
        setError('Unknown error occurred')
      }
      setIsActive(false)
    }
  }, [analyserNode, stop])

  // Track mounted state and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stop()
    }
  }, [stop])

  return {
    frequencyData,
    timeDomainData,
    isActive,
    error,
    start,
    stop,
  }
}
