import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckIcon } from '../components/Icons'
import { getAccess, subscribeAccess, buyPlan, refreshAccess } from '../lib/access'
import { canUseApi, checkYookassa, fetchPayMethods, payYookassa } from '../lib/api'
import { haptic } from '../lib/telegram'
import { BOT_LINK } from '../lib/config'

const BENEFITS = [
  'План 90 дней: урок + задание ежедневно',
  'Статистика восстановления и календарь',
  'Паник-кнопка и стрик — навсегда с тобой',
  'Никто не узнает: нейтральное название, всё в Telegram',
]

const METHODS = [
  { id: 'stars', label: '⭐ Telegram Stars' },
  { id: 'card', label: '💳 Карта (физ. лицо)' },
  { id: 'company', label: '🏢 Юр. лицо / ИП' },
]

function plural(n, one, few, many) {
  const a = n % 10
  const b = n % 100
  if (b >= 11 && b <= 14) return many
  if (a === 1) return one
  if (a >= 2 && a <= 4) return few
  return many
}

export default function Paywall() {
  const navigate = useNavigate()
  const access = useSyncExternalStore(subscribeAccess, getAccess)
  const [planId, setPlanId] = useState('year')
  const [method, setMethod] = useState('stars')
  const [yookassa, setYookassa] = useState(false)
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [inn, setInn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [waiting, setWaiting] = useState(false) // ждём подтверждения оплаты картой

  useEffect(() => {
    fetchPayMethods().then((m) => setYookassa(Boolean(m.yookassa)))
  }, [])

  const plans = access.plans
  const month = plans.find((p) => p.id === 'month')
  const selected = plans.find((p) => p.id === planId) ?? plans[0]

  async function buy() {
    setBusy(true)
    setError(null)
    try {
      haptic('medium')
      if (method === 'stars') {
        const paid = await buyPlan(selected.id)
        if (paid) {
          haptic('success')
          navigate('/', { replace: true })
        }
        return
      }
      // Карта / юрлицо — через ЮKassa
      if (method === 'company') {
        if (!orgName.trim()) throw new Error('Укажи название организации')
        if (!/^\d{10}$/.test(inn.trim())) throw new Error('ИНН организации — 10 цифр')
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        throw new Error('Укажи e-mail — на него придёт чек')
      }
      await payYookassa(selected.id, method === 'company' ? 'company' : 'individual', {
        email: email.trim(),
        ...(method === 'company' ? { org_name: orgName.trim(), inn: inn.trim() } : {}),
      })
      setWaiting(true)
    } catch (e) {
      setError(e.message || 'Не получилось открыть оплату. Попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  async function checkPaid() {
    haptic('light')
    try {
      await checkYookassa() // опрашивает ЮKassa по нашим незавершённым платежам
    } catch {
      /* сеть/сервер — ниже покажем «не подтверждена» */
    }
    await refreshAccess()
    if (getAccess().status === 'premium') {
      haptic('success')
      navigate('/', { replace: true })
    } else {
      setError('Оплата пока не подтверждена. Если ты уже оплатил — подожди минуту и проверь ещё раз.')
    }
  }

  function perMonth(p) {
    return Math.round(p.rub / Math.round(p.days / 30))
  }

  const showMethods = canUseApi && yookassa

  return (
    <div className="page paywall">
      <div className="paywall__hero">
        <h1>Твои 90 дней</h1>
        <p>Система вместо силы воли. Дешевле, чем ещё один потерянный год.</p>
      </div>

      <ul className="paywall__benefits">
        {BENEFITS.map((b) => (
          <li key={b}>
            <CheckIcon width={18} height={18} />
            {b}
          </li>
        ))}
      </ul>

      <div className="plans">
        {plans.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`plan${p.id === planId ? ' is-active' : ''}`}
            onClick={() => {
              haptic('light')
              setPlanId(p.id)
            }}
          >
            <span className="plan__title">
              {p.title}
              {p.id === 'year' && <em className="plan__badge">выгодно</em>}
            </span>
            <span className="plan__price">{p.rub} ₽</span>
            <span className="plan__permonth">
              {p.id === 'month'
                ? 'полная цена'
                : `${perMonth(p)} ₽/мес · скидка ${Math.round(100 - (perMonth(p) / month.rub) * 100)}%`}
            </span>
          </button>
        ))}
      </div>

      {showMethods && (
        <div className="paymethods">
          <h2 className="section-label">Способ оплаты</h2>
          <div className="paymethods__row">
            {METHODS.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`chip${method === m.id ? ' is-active' : ''}`}
                onClick={() => {
                  haptic('light')
                  setMethod(m.id)
                  setError(null)
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {method !== 'stars' && (
            <div className="paymethods__fields">
              {method === 'company' && (
                <>
                  <input
                    className="input"
                    type="text"
                    placeholder="Название организации"
                    value={orgName}
                    maxLength={120}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    placeholder="ИНН (10 цифр)"
                    value={inn}
                    maxLength={10}
                    onChange={(e) => setInn(e.target.value.replace(/\D/g, ''))}
                  />
                </>
              )}
              <input
                className="input"
                type="email"
                placeholder="E-mail для чека"
                value={email}
                maxLength={120}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {canUseApi ? (
        <>
          {waiting ? (
            <button type="button" className="btn btn--primary btn--big paywall__cta" onClick={checkPaid}>
              Я оплатил — проверить
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--big paywall__cta"
              disabled={busy}
              onClick={buy}
            >
              {busy ? 'Открываем оплату…' : `Начать за ${selected.rub} ₽`}
            </button>
          )}
          <p className="paywall__note">
            {method === 'stars'
              ? `Оплата в Telegram Stars (${selected.stars} ⭐) · ${selected.days} ${plural(selected.days, 'день', 'дня', 'дней')} полного доступа`
              : `Оплата через ЮKassa · чек придёт на e-mail · ${selected.days} ${plural(selected.days, 'день', 'дня', 'дней')} полного доступа`}
          </p>
          {error && <p className="paywall__error">{error}</p>}
        </>
      ) : (
        <>
          <a className="btn btn--primary btn--big paywall__cta" href={BOT_LINK}>
            Оформить в Telegram
          </a>
          <p className="paywall__note">Подписка оформляется в приложении Telegram — открой бота.</p>
        </>
      )}

      {access.status !== 'free' && (
        <button
          type="button"
          className="paywall__later"
          onClick={() => {
            haptic('light')
            navigate('/', { replace: true })
          }}
        >
          Позже — начну с бесплатных суток
        </button>
      )}

      <p className="paywall__legal">
        Нажимая «Начать», вы принимаете{' '}
        <a href="docs/oferta.html" target="_blank" rel="noreferrer">оферту и правила сервиса</a>,{' '}
        <a href="docs/privacy.html" target="_blank" rel="noreferrer">политику обработки ПДн</a>{' '}
        и даёте{' '}
        <a href="docs/consent.html" target="_blank" rel="noreferrer">согласие на обработку ПДн</a>.
      </p>
    </div>
  )
}
