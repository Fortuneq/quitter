import { useEffect, useState } from 'react'

const R = 120
const STROKE = 7
const CIRC = 2 * Math.PI * R

function pad(n) {
  return String(n).padStart(2, '0')
}

// Кольцо прогресса до следующей вехи с живым таймером стрика внутри
export default function StreakRing({ streakStart, streakDays, nextMilestone, progress }) {
  const [, force] = useState(0)

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const ms = streakStart ? Date.now() - streakStart : 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const size = (R + STROKE) * 2
  return (
    <div className="ring">
      <svg
        className="ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f8cff" />
            <stop offset="100%" stopColor="#38e0c8" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={STROKE}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - Math.max(0.005, progress))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring__center">
        <span className="ring__days">{streakDays}</span>
        <span className="ring__label">{dayWord(streakDays)} чистоты</span>
        <span className="ring__clock">
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
        <span className="ring__next">веха — {nextMilestone} дней</span>
      </div>
    </div>
  )
}

function dayWord(n) {
  const a = n % 10
  const b = n % 100
  if (b >= 11 && b <= 14) return 'дней'
  if (a === 1) return 'день'
  if (a >= 2 && a <= 4) return 'дня'
  return 'дней'
}
