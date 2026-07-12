import { useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LESSONS } from '../data/lessons'
import { getProgress, getStats, subscribe } from '../lib/store'
import { hasFullAccess, subscribeAccess, getAccess } from '../lib/access'
import { CheckIcon, LockIcon, ChevronIcon } from '../components/Icons'
import { haptic } from '../lib/telegram'

const WEEKS = Array.from({ length: 13 }, (_, i) => i) // 13 недель ≈ 90 дней

export default function Plan() {
  const progress = useSyncExternalStore(subscribe, getProgress)
  useSyncExternalStore(subscribeAccess, getAccess)
  const stats = getStats()
  const navigate = useNavigate()
  const full = hasFullAccess()

  const currentDay = Math.max(1, stats.planDay)

  function open(day, paid) {
    haptic('light')
    if (paid && !full) return navigate('/paywall')
    navigate(`/lesson/${day}`)
  }

  return (
    <div className="page plan">
      <header className="page-head">
        <h1>План 90 дней</h1>
        <p>
          Пройдено {progress.lessonsDone.length} из 90 · сегодня день {currentDay}
        </p>
      </header>

      {!full && (
        <Link className="plan-banner" to="/paywall" onClick={() => haptic('light')}>
          <LockIcon width={20} height={20} />
          <span>
            <strong>Открыть весь план</strong>
            <em>Бесплатно доступен только первый день</em>
          </span>
          <ChevronIcon width={18} height={18} />
        </Link>
      )}

      {WEEKS.map((w) => {
        const days = LESSONS.filter((l) => l.day > w * 7 && l.day <= Math.min(90, (w + 1) * 7))
        if (days.length === 0) return null
        return (
          <section key={w} className="plan-week">
            <h2 className="section-label">Неделя {w + 1}</h2>
            <div className="plan-list">
              {days.map((l) => {
                const done = progress.lessonsDone.includes(l.day)
                const future = l.day > currentDay
                const paidLocked = l.day > 1 && !full
                const locked = future || paidLocked
                return (
                  <button
                    key={l.day}
                    type="button"
                    className={`plan-item${done ? ' is-done' : ''}${locked ? ' is-locked' : ''}`}
                    disabled={future}
                    onClick={() => open(l.day, paidLocked)}
                  >
                    <span className={`plan-item__day${l.day === currentDay ? ' is-today' : ''}`}>
                      {done ? <CheckIcon width={16} height={16} /> : l.day}
                    </span>
                    <span className="plan-item__title">{l.title}</span>
                    {locked && <LockIcon width={16} height={16} className="plan-item__lock" />}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
