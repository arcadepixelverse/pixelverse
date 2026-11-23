import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { HigherLower } from './pages/HigherLower'
import { Jailbreak } from './pages/Jailbreak'
import { MindReader } from './pages/MindReader'
import { TuringTest } from './pages/TuringTest'
import { SurvivalProtocol } from './pages/SurvivalProtocol'
import { Vault } from './pages/Vault'
import { Wingman } from './pages/Wingman'
import { CyberSprint } from './pages/CyberSprint'
import { SignalSync } from './pages/SignalSync'
import { Overclock } from './pages/Overclock'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { AdminConsole } from './pages/AdminConsole'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  const [isBanned, setIsBanned] = useState(false)

  useEffect(() => {
    const handleBanned = () => setIsBanned(true)
    window.addEventListener('pixelverse:user-banned', handleBanned)
    return () => window.removeEventListener('pixelverse:user-banned', handleBanned)
  }, [])
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
        <Route
          path="/games/cyber-sprint"
          element={
            <ProtectedRoute>
              <CyberSprint />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/signal-sync"
          element={
            <ProtectedRoute>
              <SignalSync />
            </ProtectedRoute>
          }
        />
        <Route
          path="/games/overclock"
          element={
            <ProtectedRoute>
              <Overclock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminConsole />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Uncloseable Full-Screen Ban Modal at z-[9999] */}
      {isBanned && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl select-none">
          <div
            style={{
              background: 'rgba(18, 5, 8, 0.98)',
              border: '2px solid rgba(255, 55, 95, 0.8)',
              boxShadow: '0 0 80px rgba(255, 55, 95, 0.45)',
            }}
            className="max-w-lg w-full rounded-3xl p-8 sm:p-10 text-center text-white relative pointer-events-auto"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-red-500/20 border-2 border-red-500/60 text-4xl shadow-[0_0_35px_rgba(255,55,95,0.6)] animate-pulse">
              ⛔
            </div>
            <h2
              style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}
              className="text-xl sm:text-2xl font-black uppercase text-red-500 mb-4 leading-tight"
            >
              TERMINAL LOCKOUT // ACCESS REVOKED
            </h2>
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 mb-6">
              <p
                style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                className="text-sm font-bold text-red-200 leading-relaxed uppercase"
              >
                YOUR ID IS SUSPENDED BY THE OWNER DUE TO UNWANTED BEHAVIOR.
              </p>
            </div>
            <p style={{ fontFamily: 'monospace' }} className="text-xs text-white/40 tracking-wider">
              SYSTEM STATUS: PERMANENTLY LOCKED • CLEARANCE VOID
            </p>
          </div>
        </div>
      )}
    </BrowserRouter>
  )
}

export default App
