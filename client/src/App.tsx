import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { HigherLower } from './pages/HigherLower'
import { Jailbreak } from './pages/Jailbreak'
import { MindReader } from './pages/MindReader'
import { TuringTest } from './pages/TuringTest'
import { SurvivalProtocol } from './pages/SurvivalProtocol'
import { Vault } from './pages/Vault'
import { Wingman } from './pages/Wingman'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ProtectedRoute } from './components/ProtectedRoute'

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
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/higher-lower"
          element={
            <ProtectedRoute>
              <HigherLower />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/jailbreak"
          element={
            <ProtectedRoute>
              <Jailbreak />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/mind-reader"
          element={
            <ProtectedRoute>
              <MindReader />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/turing-test"
          element={
            <ProtectedRoute>
              <TuringTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/survival"
          element={
            <ProtectedRoute>
              <SurvivalProtocol />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/vault"
          element={
            <ProtectedRoute>
              <Vault />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/wingman"
          element={
            <ProtectedRoute>
              <Wingman />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
