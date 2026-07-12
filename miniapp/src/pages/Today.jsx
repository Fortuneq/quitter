import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StreakRing from '../components/StreakRing'
import Tree from '../components/Tree'
import { ChevronIcon, SosIcon } from '../components/Icons'
import {
  getProgress,
  getStats,
  subscribe,
  recordRelapse,
  ensureStarted,
} from '../lib/store'
import { lessonByDay } from '../data/lessons'
import { haptic } from '../lib/telegram'

export default function Today() {
  const progress = useSyncExternalStore(subscribe, getProgress)
  const stats = getStats()
  const navigate = useNavigate()
  const [confirmRelapse, setConfirmRelapse] = useState(false)

  // Прямой заход мимо онбординга — стартуем программу молча
  if (!progress.startedAt) ensureStarted()

  const lesson = lessonByDay(Math.max(1, stats.planDay))
  const lessonDone = progress.lessonsDone.includes(lesson?.day)

  function relapse() {
    haptic('medium')
    recordRelapse()
    setConfirmRelapse(false)
    navigate('/lesson/' + Math.max(1, stats.planDay))
  }

  return (
    <div className="page today">
      <header className="today-head">
        <div>
          <h1>Ребут</h1>
          <p>День {Math.max(1, stats.planDay)} из 90</p>
        </div>
        <span className="today-head__recovery">
          <em>{stats.recovery}%</em> восстановления
        </span>
      </header>

      <StreakRing
        streakStart={progress.streakStart}
        streakDays={stats.streakDays}
        nextMilestone={stats.nextMilestone}
        progress={stats.ringProgress}
      />

      <Tree days={stats.streakDays} />

      {lesson && (
        <Link className="lesson-card" to={`/lesson/${lesson.day}`} onClick={() => haptic('light')}>
          <div className="lesson-card__body">
            <span className="lesson-card__kicker">
              Урок дня {lessonDone ? '· пройден ✓' : '· 2 мин'}
            </span>
            <strong>{lesson.title}</strong>
            <span className="lesson-card__task">{lesson.task}</span>
          </div>
          <ChevronIcon className="lesson-card__chev" />
        </Link>
      )}

      <button
        type="button"
        className="btn btn--panic"
        onClick={() => {
          haptic('medium')
          navigate('/panic')
        }}
      >
        <SosIcon width={20} height={20} />
        Тянет? Жми сюда
      </button>

      {confirmRelapse ? (
        <div className="relapse-confirm">
          <p>Срыв не обнуляет путь — только текущий стрик. Дерево и план останутся с тобой.</p>
          <div className="relapse-confirm__row">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmRelapse(false)}>
              Отмена
            </button>
            <button type="button" className="btn btn--danger" onClick={relapse}>
              Да, сорвался
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="relapse-link" onClick={() => setConfirmRelapse(true)}>
          Я сорвался
        </button>
      )}
    </div>
  )
}
