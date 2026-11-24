import { useState } from 'react'
import { isMuted, toggleMute, playHover } from '../lib/soundEngine'

interface SfxToggleProps {
  className?: string
}

/** Neon header pill that toggles the global sound engine on/off. */
export function SfxToggle({ className = '' }: SfxToggleProps) {
  const [muted, setMuted] = useState(isMuted())

  const handleToggle = () => {
    setMuted(toggleMute())
  }

  const tone = muted
    ? 'bg-white/5 hover:bg-white/10 text-white/40 border-white/10 hover:border-white/25'
    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:border-cyan-400/70 shadow-[0_0_12px_rgba(0,245,255,0.18)]'

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={playHover}
      aria-pressed={!muted}
      title={muted ? 'Enable sound effects' : 'Mute sound effects'}
      className={`text-xs font-mono font-bold tracking-wider px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${tone} ${className}`}
    >
      {muted ? '[ SFX: OFF ]' : '[ SFX: ON ]'}
    </button>
  )
}

export default SfxToggle
