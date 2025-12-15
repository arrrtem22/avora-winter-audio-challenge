import { useEffect } from 'react'
import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'
import './App.css'

/**
 * Fixed canvas dimensions for the challenge.
 * DO NOT MODIFY - visualizers will be displayed side-by-side for comparison.
 * Aspect ratio: 4:3 (320x240)
 */
const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 240

function App() {
  const { frequencyData, timeDomainData, isActive, error, start } = useAudio()

  useEffect(() => {
    start()
  }, [start])

  return (
    <div className="app">
      <header>
        <h1>Avora Winter Waveform Challenge 2026</h1>
        {error && <p className="error">{error}</p>}
      </header>

      <main>
        <Visualizer
          frequencyData={frequencyData}
          timeDomainData={timeDomainData}
          isActive={isActive}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />
      </main>
    </div>
  )
}

export default App
