import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QUIZ, REVIEWS, computeScore, yearsInLoop } from '../data/quiz'
import { finishQuiz } from '../lib/store'
import { getUser, haptic } from '../lib/telegram'
import { CheckIcon } from '../components/Icons'

// Онбординг-квиз: 11 экранов → «твой план готов» → пейволл
export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [multi, setMulti] = useState([])

  const screen = QUIZ[step]
  const progress = (step + 1) / QUIZ.length

  function next(patch = {}) {
    haptic('light')
    const merged = { ...answers, ...patch }
    setAnswers(merged)
    if (step < QUIZ.length - 1) {
      setStep(step + 1)
      window.scrollTo(0, 0)
    }
  }

  function finish() {
    haptic('success')
    finishQuiz(answers, computeScore(answers))
    navigate('/paywall', { replace: true, state: { fromQuiz: true } })
  }

  const score = useMemo(() => computeScore(answers), [answers])
  const years = useMemo(() => yearsInLoop(answers), [answers])
  const name = getUser()?.first_name

  return (
    <div className="page onboarding">
      <div className="quiz-progress">
        <div className="quiz-progress__bar" style={{ width: `${progress * 100}%` }} />
      </div>

      {(screen.type === 'choice' || screen.type === 'multi') && (
        <>
          <h1 className="quiz-title">{screen.title}</h1>
          {screen.subtitle && <p className="quiz-subtitle">{screen.subtitle}</p>}
          <div className="quiz-options">
            {screen.options.map((o) => {
              const active = screen.type === 'multi' && multi.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`quiz-option${active ? ' is-active' : ''}`}
                  onClick={() => {
                    if (screen.type === 'multi') {
                      haptic('light')
                      setMulti((m) =>
                        m.includes(o.id) ? m.filter((x) => x !== o.id) : [...m, o.id],
                      )
                    } else {
                      next({ [screen.id]: o.id })
                    }
                  }}
                >
                  <span>{o.label}</span>
                  {o.note && <em>{o.note}</em>}
                  {active && <CheckIcon width={18} height={18} />}
                </button>
              )
            })}
          </div>
          {screen.type === 'multi' && (
            <button
              type="button"
              className="btn btn--primary btn--big quiz-cta"
              disabled={multi.length === 0}
              onClick={() => next({ [screen.id]: multi })}
            >
              Дальше
            </button>
          )}
        </>
      )}

      {screen.type === 'info' && (
        <div className="quiz-shock">
          <h1 className="quiz-title">{screen.title}</h1>
          <p className="quiz-shock__big">
            ≈ {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'} твой мозг получал
            дофаминовые пики в разы выше естественных.
          </p>
          <ShockChart />
          <p className="quiz-shock__text">
            Мозг защищается: убирает дофаминовые рецепторы. Поэтому обычная жизнь кажется
            серой, а сила воли не срабатывает — это не про характер, это про химию.
            Хорошая новость: процесс обратим.
          </p>
          <button type="button" className="btn btn--primary btn--big quiz-cta" onClick={() => next()}>
            Понятно, что дальше?
          </button>
        </div>
      )}

      {screen.type === 'score' && (
        <div className="quiz-score">
          <h1 className="quiz-title">{screen.title}</h1>
          <div className="quiz-score__dial">
            <span className="quiz-score__num">{score.toFixed(1)}</span>
            <span className="quiz-score__den">/10</span>
          </div>
          <p className="quiz-score__note">
            Выше, чем у <strong>84%</strong> прошедших тест. Это не приговор — это точка
            старта. Дальше кривая идёт вверх.
          </p>
          <button type="button" className="btn btn--primary btn--big quiz-cta" onClick={() => next()}>
            Показать мой план
          </button>
        </div>
      )}

      {screen.type === 'promise' && (
        <div className="quiz-promise">
          <h1 className="quiz-title">{screen.title}</h1>
          <PromiseChart />
          <ul className="quiz-promise__list">
            <li><strong>Неделя 1–2:</strong> уходит туман в голове, сон глубже</li>
            <li><strong>Неделя 3–4:</strong> энергия и концентрация растут</li>
            <li><strong>День 30–60:</strong> уверенность, интерес к реальной жизни</li>
            <li><strong>День 90:</strong> рецепторы восстановлены — ты другой человек</li>
          </ul>
          <button type="button" className="btn btn--primary btn--big quiz-cta" onClick={() => next()}>
            Дальше
          </button>
        </div>
      )}

      {screen.type === 'reviews' && (
        <div className="quiz-reviews">
          <h1 className="quiz-title">{screen.title}</h1>
          {REVIEWS.map((r) => (
            <blockquote key={r.name} className="review">
              <p>«{r.text}»</p>
              <footer>
                {r.name} · день {r.days}
              </footer>
            </blockquote>
          ))}
          <button type="button" className="btn btn--primary btn--big quiz-cta" onClick={() => next()}>
            Дальше
          </button>
        </div>
      )}

      {screen.type === 'final' && (
        <div className="quiz-final">
          <h1 className="quiz-title">
            {name ? `${name}, твой план готов` : 'Твой план готов'}
          </h1>
          <ul className="quiz-final__list">
            <li>🎯 90 дней: урок + микрозадание на каждый день</li>
            <li>🔥 Стрик-каунтер и вехи 7 / 14 / 30 / 60 / 90</li>
            <li>🆘 Паник-кнопка на случай тяги</li>
            <li>🌳 Дерево, которое растёт с тобой</li>
            <li>📊 Статистика восстановления дофамина</li>
          </ul>
          <button type="button" className="btn btn--primary btn--big quiz-cta" onClick={finish}>
            Начать 90 дней
          </button>
          <p className="quiz-final__note">Первые 24 часа — полный доступ бесплатно</p>
        </div>
      )}
    </div>
  )
}

// Дофаминовые пики: порно против естественных радостей
function ShockChart() {
  const bars = [
    { h: 18, label: 'еда' },
    { h: 26, label: 'спорт' },
    { h: 34, label: 'секс' },
    { h: 100, label: 'п*рно', hot: true },
  ]
  return (
    <div className="shock-chart">
      {bars.map((b) => (
        <div key={b.label} className="shock-chart__col">
          <div
            className={`shock-chart__bar${b.hot ? ' is-hot' : ''}`}
            style={{ height: `${b.h}%` }}
          />
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// Кривая «твои 90 дней» — рост энергии/ясности
function PromiseChart() {
  return (
    <svg className="promise-chart" viewBox="0 0 320 140" aria-hidden="true">
      <defs>
        <linearGradient id="pGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4f8cff" />
          <stop offset="100%" stopColor="#38e0c8" />
        </linearGradient>
        <linearGradient id="pFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(56,224,200,0.25)" />
          <stop offset="100%" stopColor="rgba(56,224,200,0)" />
        </linearGradient>
      </defs>
      <path
        d="M10 120 C 80 118, 100 90, 150 65 S 260 25, 310 18 L 310 130 L 10 130 Z"
        fill="url(#pFill)"
      />
      <path
        d="M10 120 C 80 118, 100 90, 150 65 S 260 25, 310 18"
        fill="none"
        stroke="url(#pGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <g fill="#7d8aa5" fontSize="11" fontFamily="inherit">
        <text x="10" y="139">день 1</text>
        <text x="150" y="139">день 45</text>
        <text x="282" y="139">день 90</text>
      </g>
    </svg>
  )
}
