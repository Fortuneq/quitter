// Прогресс пользователя: стрик, срывы, пройденные уроки, паник-лог, квиз.
// localStorage — источник правды, Telegram CloudStorage и бэкенд — зеркала
// для переносимости между устройствами.
import { cloudGet, cloudSet } from './telegram'
import { canUseApi, fetchState, pushState } from './api'

const KEY = 'quitter.progress.v1'

const empty = {
  quiz: null, // { answers, score, finishedAt }
  startedAt: null, // старт программы (первый день плана)
  streakStart: null, // начало текущего стрика
  bestStreakMs: 0, // лучший стрик за всю историю (фиксируется при срыве)
  relapses: [], // [{ts, note?}] — история срывов, не стирается
  lessonsDone: [], // [day, ...]
  panicLog: [], // [ts, ...] — сколько раз паник-кнопка спасала
}

let state = load()
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...JSON.parse(raw) }
  } catch {
    /* повреждённые данные — начинаем заново */
  }
  return { ...empty }
}

function persist() {
  const raw = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    /* noop */
  }
  cloudSet(KEY, raw)
  if (canUseApi) pushState(state).catch(() => {})
  listeners.forEach((fn) => fn(state))
}

// Чей прогресс «длиннее»: сравниваем по числу событий
function weight(s) {
  return (
    (s.relapses?.length ?? 0) +
    (s.lessonsDone?.length ?? 0) +
    (s.panicLog?.length ?? 0) +
    (s.startedAt ? 1 : 0) +
    (s.quiz ? 1 : 0)
  )
}

// При старте подтягиваем облако и бэкенд: берём самое полное состояние.
export async function syncFromCloud() {
  const candidates = []
  const raw = await cloudGet(KEY)
  if (raw) {
    try {
      candidates.push({ ...empty, ...JSON.parse(raw) })
    } catch {
      /* noop */
    }
  }
  if (canUseApi) {
    try {
      const { state: remote } = await fetchState()
      if (remote) candidates.push({ ...empty, ...remote })
    } catch {
      /* noop */
    }
  }
  for (const c of candidates) {
    if (weight(c) > weight(state)) {
      state = c
      persist()
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getProgress() {
  return state
}

// --- Действия ---

export function finishQuiz(answers, score) {
  state = { ...state, quiz: { answers, score, finishedAt: Date.now() } }
  if (!state.startedAt) {
    state = { ...state, startedAt: Date.now(), streakStart: Date.now() }
  }
  persist()
}

// Старт без квиза (повторный вход, «начать заново»)
export function ensureStarted() {
  if (state.startedAt) return
  state = { ...state, startedAt: Date.now(), streakStart: Date.now() }
  persist()
}

// Срыв: текущий стрик уходит в историю, план 90 дней НЕ обнуляется
export function recordRelapse(note = '') {
  const now = Date.now()
  const cur = state.streakStart ? now - state.streakStart : 0
  state = {
    ...state,
    bestStreakMs: Math.max(state.bestStreakMs, cur),
    relapses: [...state.relapses, { ts: now, note }],
    streakStart: now,
  }
  persist()
}

export function completeLesson(day) {
  if (state.lessonsDone.includes(day)) return
  state = { ...state, lessonsDone: [...state.lessonsDone, day] }
  persist()
}

export function recordPanic() {
  state = { ...state, panicLog: [...state.panicLog, Date.now()] }
  persist()
}

// Полный сброс (кнопка в профиле)
export function resetProgress() {
  state = { ...empty }
  persist()
}

// --- Производные метрики ---

export const MILESTONES = [7, 14, 30, 60, 90]

export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getStats() {
  const now = Date.now()
  const streakMs = state.streakStart ? now - state.streakStart : 0
  const streakDays = Math.floor(streakMs / 86400000)
  const bestMs = Math.max(state.bestStreakMs, streakMs)
  const bestDays = Math.floor(bestMs / 86400000)

  // День программы: идёт от старта и не сбрасывается срывами
  const planDay = state.startedAt
    ? Math.min(90, Math.floor((now - state.startedAt) / 86400000) + 1)
    : 0

  // «Восстановление рецепторов»: экспонента — быстрый рост в начале,
  // насыщение к 90-му дню (день 30 ≈ 63%, день 90 ≈ 95%)
  const exactDays = streakMs / 86400000
  const recovery = Math.min(99, Math.round(100 * (1 - Math.exp(-exactDays / 30))))

  // Ближайшая веха для кольца прогресса
  const nextMilestone = MILESTONES.find((m) => m > streakDays) ?? 90
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= streakDays) ?? 0
  const ringProgress =
    nextMilestone === prevMilestone
      ? 1
      : Math.min(1, (exactDays - prevMilestone) / (nextMilestone - prevMilestone))

  const badges = MILESTONES.map((m) => ({ days: m, earned: bestDays >= m }))

  return {
    started: Boolean(state.startedAt),
    streakMs,
    streakDays,
    bestDays,
    planDay,
    recovery,
    nextMilestone,
    ringProgress,
    badges,
    relapseCount: state.relapses.length,
    panicCount: state.panicLog.length,
    lessonsDone: state.lessonsDone.length,
  }
}

// Календарь последних N дней: срывы и чистые дни (для сетки статистики)
export function getCalendar(days = 90) {
  const relapseDays = new Set(state.relapses.map((r) => todayKey(new Date(r.ts))))
  const start = state.startedAt ? todayKey(new Date(state.startedAt)) : null
  const cells = []
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i += 1) {
    const key = todayKey(d)
    cells.push({
      key,
      relapse: relapseDays.has(key),
      inProgram: start !== null && key >= start,
    })
    d.setDate(d.getDate() + 1)
  }
  return cells
}
