import { useEffect } from 'react'
import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'
import './App.css'

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
        />
      </main>
    </div>
  )
}

export default App
