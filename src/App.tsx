import { useEffect } from 'react'
import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'
import './App.css'

/**
 * Fixed canvas dimensions for the challenge.
 * DO NOT MODIFY - visualizers will be displayed side-by-side for comparison.
 * Aspect ratio: 4:3 (640x480)
 */
const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 480

function App() {
  const { frequencyData, timeDomainData, isActive, start } = useAudio()

  useEffect(() => {
    start()
  }, [start])

  return (
    <div className="app">
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
