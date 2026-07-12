import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { getCalendar, getProgress, getStats, subscribe } from '../lib/store'
import { hasFullAccess, subscribeAccess, getAccess } from '../lib/access'
import { LockIcon } from '../components/Icons'

function plural(n, one, few, many) {
  const a = n % 10
  const b = n % 100
  if (b >= 11 && b <= 14) return many
  if (a === 1) return one
  if (a >= 2 && a <= 4) return few
  return many
}

export default function Stats() {
  useSyncExternalStore(subscribe, getProgress)
  useSyncExternalStore(subscribeAccess, getAccess)
  const stats = getStats()
  const calendar = getCalendar(90)
  const full = hasFullAccess()

  return (
    <div className="page stats">
      <header className="page-head">
        <h1>Статистика</h1>
        <p>Восстановление идёт, даже когда ты просто спишь</p>
      </header>

      <section className="recovery-card">
        <div className="recovery-card__head">
          <strong>Дофаминовые рецепторы</strong>
          <em>{stats.recovery}%</em>
        </div>
        <div className="recovery-card__bar">
          <div style={{ width: `${stats.recovery}%` }} />
        </div>
        <p>
          Оценка по текущему стрику: {stats.streakDays}{' '}
          {plural(stats.streakDays, 'чистый день', 'чистых дня', 'чистых дней')}. К 90-му дню
          чувствительность восстанавливается почти полностью.
        </p>
      </section>

      <section className="stat-grid">
        <div className="stat-cell">
          <strong>{stats.streakDays}</strong>
          <span>текущий стрик</span>
        </div>
        <div className="stat-cell">
          <strong>{stats.bestDays}</strong>
          <span>лучший стрик</span>
        </div>
        <div className="stat-cell">
          <strong>{stats.lessonsDone}</strong>
          <span>{plural(stats.lessonsDone, 'урок', 'урока', 'уроков')}</span>
        </div>
        <div className="stat-cell">
          <strong>{stats.panicCount}</strong>
          <span>{plural(stats.panicCount, 'раз спасла кнопка', 'раза спасла кнопка', 'раз спасла кнопка')}</span>
        </div>
      </section>

      <section>
        <h2 className="section-label">Значки</h2>
        <div className="badges">
          {stats.badges.map((b) => (
            <div key={b.days} className={`badge${b.earned ? ' is-earned' : ''}`}>
              <span className="badge__num">{b.days}</span>
              <span className="badge__sub">дней</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-label">Календарь · 90 дней</h2>
        {full ? (
          <>
            <div className="calendar">
              {calendar.map((c) => (
                <div
                  key={c.key}
                  className={`calendar__cell${
                    c.relapse ? ' is-relapse' : c.inProgram ? ' is-clean' : ''
                  }`}
                  title={c.key}
                />
              ))}
            </div>
            <p className="calendar__legend">
              <span className="dot dot--clean" /> чистый день
              <span className="dot dot--relapse" /> срыв · {stats.relapseCount} за всё время
            </p>
          </>
        ) : (
          <Link className="plan-banner" to="/paywall">
            <LockIcon width={20} height={20} />
            <span>
              <strong>Календарь и полная статистика</strong>
              <em>Доступны с подпиской</em>
            </span>
          </Link>
        )}
      </section>
    </div>
  )
}
