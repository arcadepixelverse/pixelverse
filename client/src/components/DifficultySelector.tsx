export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

interface DifficultySelectorProps {
  difficulty: Difficulty
  onChange: (difficulty: Difficulty) => void
  disabled?: boolean
  className?: string
}

export function DifficultySelector({
  difficulty,
  onChange,
  disabled = false,
  className = '',
}: DifficultySelectorProps) {
  const options: { id: Difficulty; label: string; mult: string; colorClass: string; activeGlow: string }[] = [
    {
      id: 'easy',
      label: 'EASY',
      mult: '1x',
      colorClass: 'text-green-400',
      activeGlow: 'bg-green-500/20 border-green-400 text-green-300 shadow-[0_0_20px_rgba(48,209,88,0.4)]',
    },
    {
      id: 'medium',
      label: 'MEDIUM',
      mult: '2x',
      colorClass: 'text-cyan-400',
      activeGlow: 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,245,255,0.4)]',
    },
    {
      id: 'hard',
      label: 'HARD',
      mult: '3x',
      colorClass: 'text-red-400',
      activeGlow: 'bg-red-500/20 border-red-500 text-red-300 shadow-[0_0_20px_rgba(255,55,95,0.45)]',
    },
  ]

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between px-1 text-[11px] font-mono uppercase text-white/50 tracking-wider">
        <span>TACTICAL DIFFICULTY</span>
        <span className="text-white/40">SCORE MULTIPLIER</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 p-1 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md">
        {options.map((opt) => {
          const isSelected = difficulty === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              style={{ touchAction: 'manipulation' }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected
                  ? opt.activeGlow
                  : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/70 hover:bg-white/[0.05]'
              }`}
            >
              <span className="tracking-widest">{opt.label}</span>
              <span className={`text-[10px] font-black ${isSelected ? 'text-white' : opt.colorClass}`}>
                {opt.mult} PTS
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DifficultySelector
