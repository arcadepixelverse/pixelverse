import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { HigherLower } from './pages/HigherLower'
import { Jailbreak } from './pages/Jailbreak'
import { MindReader } from './pages/MindReader'

function App() {
  return (
    <BrowserRouter>
      {/* Animated mesh gradient background */}
      <div className="mesh-bg">
        <div className="mesh-orb-3" />
      </div>

      {/* CRT scanline overlay */}
      <div className="scanlines" />

      {/* Routing */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/games/higher-lower" element={<HigherLower />} />
        <Route path="/games/jailbreak" element={<Jailbreak />} />
        <Route path="/games/mind-reader" element={<MindReader />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
