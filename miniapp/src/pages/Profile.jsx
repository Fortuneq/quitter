import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { getAccess, subscribeAccess } from '../lib/access'
import { getProgress, getStats, subscribe, resetProgress } from '../lib/store'
import { getUser, haptic } from '../lib/telegram'
import { canUseApi, revokeConsent } from '../lib/api'
import { CheckIcon, LockIcon } from '../components/Icons'
import { BOT_USERNAME } from '../lib/config'

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function plural(n, one, few, many) {
  const a = n % 10
  const b = n % 100
  if (b >= 11 && b <= 14) return many
  if (a === 1) return one
  if (a >= 2 && a <= 4) return few
  return many
}

export default function Profile() {
  const access = useSyncExternalStore(subscribeAccess, getAccess)
  useSyncExternalStore(subscribe, getProgress)
  const user = getUser()
  const stats = getStats()
  const [busy, setBusy] = useState(false)

  // Отзыв согласия = удаление профиля и данных (152-ФЗ)
  async function revoke() {
    const ok = window.confirm(
      'Отозвать согласие на обработку персональных данных?\n\n' +
        'Профиль, подписка и весь прогресс будут удалены, ' +
        'приложение перестанет быть доступным до повторного принятия условий.',
    )
    if (!ok) return
    setBusy(true)
    try {
      haptic('medium')
      await revokeConsent()
      localStorage.clear()
      window.location.reload()
    } catch {
      setBusy(false)
      window.alert('Не получилось связаться с сервером. Попробуй ещё раз или используй /delete_me в боте.')
    }
  }

  function restart() {
    const ok = window.confirm(
      'Начать программу заново?\n\nСтрик, срывы и пройденные уроки будут сброшены.',
    )
    if (!ok) return
    haptic('medium')
    resetProgress()
    window.location.hash = '#/onboarding'
  }

  const sub =
    access.status === 'premium'
      ? {
          title: 'Подписка активна',
          sub: `Полный доступ до ${fmtDate(access.premiumUntil)}`,
          cta: 'Продлить',
        }
      : access.status === 'trial'
        ? {
            title: 'Пробный доступ',
            sub: `Полный доступ ещё ${Math.max(1, Math.ceil((access.trialUntil - Date.now()) / 3600000))} ч — дальше план закроется`,
            cta: 'Оформить подписку',
          }
        : {
            title: 'Бесплатный режим',
            sub: 'Стрик и паник-кнопка работают. Подписка откроет план 90 дней и статистику.',
            cta: 'Оформить подписку',
          }

  return (
    <div className="page page--profile">
      <header className="profile-head">
        <div className="profile-head__avatar">
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" />
          ) : (
            <span>{(user?.first_name || 'Р')[0]}</span>
          )}
        </div>
        <h1>{user?.first_name || 'Гость'}</h1>
        {user?.username && <p className="profile-head__nick">@{user.username}</p>}
      </header>

      <section className={`subcard${access.status === 'premium' ? ' subcard--active' : ''}`}>
        <div className="subcard__icon">
          {access.status === 'premium' ? <CheckIcon /> : <LockIcon />}
        </div>
        <div className="subcard__body">
          <strong>{sub.title}</strong>
          <span>{sub.sub}</span>
        </div>
        <Link className="btn btn--primary" to="/paywall">
          {sub.cta}
        </Link>
      </section>

      <section className="profile-stats">
        <div className="done-stat">
          <strong>{stats.streakDays}</strong>
          <span>{plural(stats.streakDays, 'день чистоты', 'дня чистоты', 'дней чистоты')}</span>
        </div>
        <div className="done-stat">
          <strong>{stats.bestDays}</strong>
          <span>лучший стрик</span>
        </div>
        <div className="done-stat">
          <strong>{stats.lessonsDone}</strong>
          <span>{plural(stats.lessonsDone, 'урок', 'урока', 'уроков')}</span>
        </div>
      </section>

      <nav className="profile-links">
        <Link to="/stats">Статистика и календарь</Link>
        <a href="docs/oferta.html" target="_blank" rel="noreferrer">Оферта и правила сервиса</a>
        <a href="docs/privacy.html" target="_blank" rel="noreferrer">Политика обработки ПДн</a>
        <a href="docs/consent.html" target="_blank" rel="noreferrer">Согласие на обработку ПДн</a>
      </nav>

      <button type="button" className="ghost-link" onClick={restart}>
        Начать программу заново
      </button>

      {canUseApi && (
        <button type="button" className="danger-link" disabled={busy} onClick={revoke}>
          {busy ? 'Удаляем…' : 'Отозвать согласие на обработку ПДн и удалить данные'}
        </button>
      )}
      <p className="profile-note">
        То же самое можно сделать командой /delete_me в боте @{BOT_USERNAME}.
      </p>
    </div>
  )
}
