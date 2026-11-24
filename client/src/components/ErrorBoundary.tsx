import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Render fault captured:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="relative z-[9999] min-h-screen flex items-center justify-center px-4 py-12 bg-[#0A0A0F]">
        <div
          className="w-full max-w-lg rounded-3xl border p-6 sm:p-10 text-center font-mono"
          style={{
            background: 'rgba(18, 5, 8, 0.98)',
            borderColor: 'rgba(255, 55, 95, 0.55)',
            boxShadow: '0 0 60px rgba(255, 55, 95, 0.3), inset 0 0 20px rgba(255, 55, 95, 0.06)',
          }}
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center text-3xl bg-red-500/15 border border-red-500/50 shadow-[0_0_30px_rgba(255,55,95,0.5)] animate-pulse">
            ⚠️
          </div>

          <h1 className="text-lg sm:text-2xl font-black uppercase tracking-[0.15em] text-red-500 leading-tight mb-3">
            SYSTEM FAULT // RELOAD MODULE
          </h1>
          <p className="text-[11px] sm:text-xs text-red-200/70 uppercase tracking-wider leading-relaxed mb-6">
            An unexpected runtime fault cracked the interface. The core is intact — reboot the module
            to restore the arcade.
          </p>

          {/* Fault trace */}
          {this.state.error?.message && (
            <div className="p-3 rounded-xl bg-black/40 border border-red-500/30 text-left text-[11px] leading-relaxed text-rose-300 break-all mb-8">
              <span className="text-red-500">fault:</span> {this.state.error.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.35)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Reload Module ↻
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="flex-1 py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest text-white/70 hover:text-white border border-white/20 hover:border-white/40 backdrop-blur-md transition-all cursor-pointer"
            >
              Arcade Menu
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
