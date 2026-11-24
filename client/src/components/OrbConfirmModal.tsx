import { useEffect, useRef, useState } from 'react'
import { playClick, playError } from '../lib/soundEngine'

interface OrbConfirmModalProps {
  gameTitle: string
  gameIcon: string
  isVip: boolean
  remainingOrbs: number
  dailyLimit: number
  onConfirm: () => void
  onClose: () => void
}

export function OrbConfirmModal({
  gameTitle,
  gameIcon,
  isVip,
  remainingOrbs,
  dailyLimit,
  onConfirm,
  onClose,
}: OrbConfirmModalProps) {
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const depleted = remainingOrbs <= 0
  const confirmed = typed.trim().toLowerCase() === 'yes'

  // Lock background scroll + autofocus + Escape handling
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleConfirm = () => {
    if (depleted || submitting) return
    if (!isVip && !confirmed) {
      playError()
      return
    }
    setSubmitting(true)
    playClick()
    onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Confirm orb spend for ${gameTitle}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-cyan-400/25 bg-[#0a0e14]/95 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,245,255,0.15)]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-cyan-400/10 border border-cyan-400/20 flex-shrink-0">
            {gameIcon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300/70">
              ORB SPEND CONFIRMATION
            </p>
            <h2 className="text-lg font-black text-white tracking-tight truncate">
              {gameTitle}
            </h2>
          </div>
        </div>

        <p className="text-sm font-mono text-white/70 mb-4 leading-relaxed">
          ARE YOU SURE YOU WANT TO USE{' '}
          <span className="text-cyan-300 font-bold">1 ORB</span> TO PLAY{' '}
          <span className="text-white font-bold uppercase">{gameTitle}</span>?
        </p>

        {/* Live balance readout */}
        <div
          className={`mb-5 rounded-lg border px-4 py-3 font-mono text-xs tracking-wider ${
            depleted
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-white/10 bg-white/[0.03] text-white/70'
          }`}
        >
          {depleted ? (
            <span className="font-bold">DEPLETED // RECHARGES AT 00:00 UTC</span>
          ) : (
            <>
              CURRENT BALANCE:{' '}
              <span className={isVip ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                {remainingOrbs} / {dailyLimit} ORBS
              </span>
            </>
          )}
        </div>

        {/* YES confirmation input — required for FREE, optional shortcut for VIP */}
        <label className="block mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
          TYPE &quot;YES&quot; TO CONFIRM
        </label>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (isVip || confirmed) && !depleted && !submitting) {
              handleConfirm()
            }
          }}
          placeholder='TYPE "YES"'
          autoComplete="off"
          spellCheck={false}
          className="w-full mb-5 rounded-lg border border-white/15 bg-black/50 px-4 py-3 font-mono text-sm tracking-[0.3em] text-white placeholder-white/20 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 uppercase"
        />

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          {isVip && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={depleted || submitting}
              className="w-full rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-yellow-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-amber-300 transition hover:from-amber-400/25 hover:to-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'LAUNCHING…' : '⚡ VIP INSTANT LAUNCH (-1 ORB)'}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={depleted || submitting || (!isVip && !confirmed)}
            className={`w-full rounded-lg border px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              isVip
                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
            }`}
          >
            {submitting
              ? 'CONSUMING ORB…'
              : depleted
              ? 'NO ORBS REMAINING'
              : `CONSUME 1 ORB & LAUNCH`}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full rounded-lg px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            [ CANCEL — ESC ]
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrbConfirmModal
