import React, { useState, useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { NotFound } from './pages/NotFound'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminGuard } from './components/AdminGuard'

// Route-level code splitting: game pages load on demand so the entry bundle
// stays lean. Dashboard/Login/Signup/NotFound remain eager for first paint.
const HigherLower = React.lazy(() => import('./pages/HigherLower'))
const Jailbreak = React.lazy(() => import('./pages/Jailbreak'))
const MindReader = React.lazy(() => import('./pages/MindReader'))
const TuringTest = React.lazy(() => import('./pages/TuringTest'))
const SurvivalProtocol = React.lazy(() => import('./pages/SurvivalProtocol'))
const Vault = React.lazy(() => import('./pages/Vault'))
const Wingman = React.lazy(() => import('./pages/Wingman'))
const CyberSprint = React.lazy(() => import('./pages/CyberSprint'))
const SignalSync = React.lazy(() => import('./pages/SignalSync'))
const Overclock = React.lazy(() => import('./pages/Overclock'))
const AdminConsole = React.lazy(() => import('./pages/AdminConsole'))

/** Hacker-terminal loader shown while a lazy route chunk is fetching. */
function ModuleLoader() {
  return (
    <div className="fixed inset-0 z-[99999] bg-black text-cyan-400 font-mono flex flex-col items-center justify-center p-6 select-none">
      <div className="flex items-center gap-3 text-sm font-black tracking-[0.3em] uppercase">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
        LOADING MODULE...
      </div>
      <p className="mt-4 text-[11px] text-cyan-500/40 tracking-widest uppercase">
        DECRYPTING GAME SECTOR // PLEASE STAND BY
      </p>
    </div>
  )
}

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

      {/* Ambient cyber-grid */}
      <div className="cyber-grid" />

      {/* CRT scanline overlay */}
      <div className="scanlines" />

      {/* Routing */}
      <Suspense fallback={<ModuleLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Convenience alias: /dashboard lands on the main Dashboard */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

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
              <AdminGuard>
                <AdminConsole />
              </AdminGuard>
            }
          />

          {/* Fallback: unknown sectors */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

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
