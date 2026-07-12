import { useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { lessonByDay } from '../data/lessons'
import { completeLesson, getProgress, getStats, subscribe } from '../lib/store'
import { hasFullAccess } from '../lib/access'
import { CheckIcon } from '../components/Icons'
import { haptic } from '../lib/telegram'

export default function Lesson() {
  const { day: dayParam } = useParams()
  const navigate = useNavigate()
  const progress = useSyncExternalStore(subscribe, getProgress)
  const stats = getStats()

  const day = Number(dayParam)
  const lesson = lessonByDay(day)

  if (!lesson || day > Math.max(1, stats.planDay)) return <Navigate to="/plan" replace />
  if (day > 1 && !hasFullAccess()) return <Navigate to="/paywall" replace />

  const done = progress.lessonsDone.includes(day)

  return (
    <div className="page lesson">
      <header className="page-head">
        <p className="lesson__kicker">День {day} из 90 · 2 минуты</p>
        <h1>{lesson.title}</h1>
      </header>

      <article className="lesson__body">
        {lesson.read.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <section className="lesson__task">
        <h2 className="section-label">Задание на сегодня</h2>
        <p>{lesson.task}</p>
      </section>

      {done ? (
        <div className="lesson__done">
          <CheckIcon width={20} height={20} />
          Урок пройден
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => {
            haptic('success')
            completeLesson(day)
            navigate(-1)
          }}
        >
          Готово — я в деле
        </button>
      )}
    </div>
  )
}
