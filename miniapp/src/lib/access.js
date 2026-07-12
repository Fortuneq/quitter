// Доступ: trial (первые 24 часа) → free (стрик и паник-кнопка, план заперт) → premium.
// Источник правды — бэкенд (/api/me). Вне Telegram или при недоступном API
// считаем локально от первого запуска, покупка недоступна.
import { canUseApi, fetchMe, purchase } from './api'

const TRIAL_KEY = 'quitter.trialStart.v1'
const TRIAL_MS = 24 * 60 * 60 * 1000

// Витрина планов для офлайна/ошибок сети — бэкенд отдаёт те же данные
const FALLBACK_PLANS = [
  { id: 'month', title: '1 месяц', rub: 799, stars: 500, days: 30 },
  { id: 'year', title: '1 год', rub: 2990, stars: 1870, days: 365 },
]

function localTrialStart() {
  let start = Number(localStorage.getItem(TRIAL_KEY))
  if (!start) {
    start = Date.now()
    try {
      localStorage.setItem(TRIAL_KEY, String(start))
    } catch {
      /* noop */
    }
  }
  return start
}

function localState() {
  const start = localTrialStart()
  const trialUntil = start + TRIAL_MS
  return {
    loading: false,
    online: false,
    status: Date.now() < trialUntil ? 'trial' : 'free',
    trialUntil,
    premiumUntil: null,
    plans: FALLBACK_PLANS,
  }
}

let state = { ...localState(), loading: canUseApi }
const listeners = new Set()

function set(next) {
  state = next
  listeners.forEach((fn) => fn(state))
}

export function subscribeAccess(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getAccess() {
  return state
}

export async function refreshAccess() {
  if (!canUseApi) {
    set(localState())
    return
  }
  try {
    const me = await fetchMe()
    set({
      loading: false,
      online: true,
      status: me.status,
      trialUntil: me.trial_until * 1000,
      premiumUntil: me.premium_until ? me.premium_until * 1000 : null,
      plans: me.plans,
    })
  } catch {
    set(localState())
  }
}

export function initAccess() {
  refreshAccess()
}

// Полный доступ (план 90 дней, статистика) открыт всем, кроме free
export function hasFullAccess() {
  return state.status !== 'free'
}

// Покупка плана; после успешной оплаты статус подтягивается с бэкенда
export async function buyPlan(planId) {
  const paid = await purchase(planId)
  if (paid) await refreshAccess()
  return paid
}
