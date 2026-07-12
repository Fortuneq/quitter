import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COLD_FACTS } from '../data/facts'
import { recordPanic, recordRelapse } from '../lib/store'
import { CloseIcon } from '../components/Icons'
import { haptic } from '../lib/telegram'

const BREATH_SEC = 60
const PHASE = 8 // 4 сек вдох + 4 сек выдох

// Паник-кнопка: дыхание 60 сек → «что чувствуешь» → холодный факт
export default function Panic() {
  const navigate = useNavigate()
  const [stage, setStage] = useState('breath') // breath | write | fact
  const [left, setLeft] = useState(BREATH_SEC)
  const [note, setNote] = useState('')
  const logged = useRef(false)

  const fact = useMemo(
    () => COLD_FACTS[Math.floor(Math.random() * COLD_FACTS.length)],
    [],
  )

  useEffect(() => {
    if (!logged.current) {
      logged.current = true
      recordPanic()
    }
  }, [])

  useEffect(() => {
    if (stage !== 'breath') return undefined
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          haptic('success')
          setStage('write')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [stage])

  const inhale = Math.floor((BREATH_SEC - left) % PHASE) < PHASE / 2

  return (
    <div className="page panic">
      <button
        type="button"
        className="panic__close"
        aria-label="Закрыть"
        onClick={() => navigate('/')}
      >
        <CloseIcon />
      </button>

      {stage === 'breath' && (
        <div className="panic__stage">
          <h1>Дыши со мной</h1>
          <p className="panic__hint">Тяга — это волна. Она спадёт. 60 секунд.</p>
          <div className={`breath${inhale ? ' is-in' : ''}`}>
            <div className="breath__circle" />
            <span className="breath__label">{inhale ? 'Вдох…' : 'Выдох…'}</span>
          </div>
          <span className="panic__timer">{left} c</span>
          <button type="button" className="panic__skip" onClick={() => setStage('write')}>
            Пропустить
          </button>
        </div>
      )}

      {stage === 'write' && (
        <div className="panic__stage">
          <h1>Что ты сейчас чувствуешь?</h1>
          <p className="panic__hint">
            Назвать эмоцию — значит вернуть контроль префронтальной коре. Напиши пару слов,
            это останется у тебя.
          </p>
          <textarea
            className="panic__input"
            rows={4}
            placeholder="Скука… стресс… одиночество…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--primary btn--big"
            onClick={() => {
              haptic('light')
              setStage('fact')
            }}
          >
            Дальше
          </button>
        </div>
      )}

      {stage === 'fact' && (
        <div className="panic__stage">
          <h1>Холодный факт</h1>
          <blockquote className="panic__fact">{fact}</blockquote>
          <button
            type="button"
            className="btn btn--primary btn--big"
            onClick={() => {
              haptic('success')
              navigate('/')
            }}
          >
            Я в порядке, отпустило
          </button>
          <button
            type="button"
            className="relapse-link"
            onClick={() => {
              haptic('medium')
              recordRelapse(note)
              navigate('/')
            }}
          >
            Я всё-таки сорвался
          </button>
        </div>
      )}
    </div>
  )
}
