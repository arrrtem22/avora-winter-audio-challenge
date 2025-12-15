import { useRef, useEffect } from 'react'

export interface VisualizerProps {
  frequencyData: React.RefObject<Uint8Array<ArrayBuffer>>
  timeDomainData: React.RefObject<Uint8Array<ArrayBuffer>>
  isActive: boolean
  width: number
  height: number
}

/**
 * Visualizer - YOUR CANVAS FOR THE CHALLENGE
 *
 * Props provided:
 *   - frequencyData: Ref to Uint8Array of FFT frequency bins (0-255 values)
 *   - timeDomainData: Ref to Uint8Array of waveform samples (0-255 values)
 *   - isActive: boolean indicating if audio is streaming
 *   - width: Canvas width (fixed, do not override)
 *   - height: Canvas height (fixed, do not override)
 *
 * The data refs are updated in-place by the audio hook. This component
 * runs its own animation loop to read the data and render.
 *
 * NOTE: Canvas dimensions are fixed at 320x240 (4:3) for side-by-side comparison.
 * Use the width/height props for your drawing calculations.
 *
 * The example below draws a simple waveform line. Replace it with your own!
 */
export function Visualizer({ frequencyData, timeDomainData, isActive, width, height }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw placeholder when not active
    if (!isActive) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#333'
      ctx.font = '16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for microphone...', width / 2, height / 2)
      return
    }

    // Animation loop - runs independently of React renders
    let frameId: number

    const draw = () => {
      const timeData = timeDomainData.current
      const freqData = frequencyData.current

      // Clear canvas
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)

      // === YOUR VISUALIZATION CODE GOES HERE ===

      const halfHeight = height / 2
      const labelPadding = 6
      const labelFontSize = 10
      const horizontalPadding = 8
      const drawWidth = width - horizontalPadding * 2

      // Divider line
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, halfHeight)
      ctx.lineTo(width, halfHeight)
      ctx.stroke()

      // Top half: Waveform
      ctx.fillStyle = '#666'
      ctx.font = `${labelFontSize}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('Waveform', labelPadding, labelFontSize + labelPadding)

      ctx.beginPath()
      ctx.strokeStyle = '#0f0'
      ctx.lineWidth = 2

      const sliceWidth = drawWidth / timeData.length
      let x = horizontalPadding

      for (let i = 0; i < timeData.length; i++) {
        const normalized = (timeData[i] - 128) / 128
        const y = halfHeight / 2 - normalized * (halfHeight / 2)

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }
      ctx.stroke()

      // Bottom half: Frequency bars (centered/mirrored)
      ctx.fillStyle = '#666'
      ctx.font = `${labelFontSize}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText('Frequency', labelPadding, halfHeight + labelFontSize + labelPadding)

      const barCount = 64
      const barWidth = drawWidth / barCount
      const barGap = 1
      const freqCenterY = halfHeight + halfHeight / 2

      for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(i * freqData.length / barCount)
        const value = freqData[freqIndex] / 255
        const barHeight = value * (halfHeight / 2)

        ctx.fillStyle = '#0f0'
        // Draw bar extending both up and down from center
        ctx.fillRect(
          horizontalPadding + i * barWidth + barGap / 2,
          freqCenterY - barHeight,
          barWidth - barGap,
          barHeight * 2
        )
      }

      // === END VISUALIZATION CODE ===

      frameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isActive, frequencyData, timeDomainData, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  )
}
