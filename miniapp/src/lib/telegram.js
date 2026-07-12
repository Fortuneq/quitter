// Обёртка над Telegram WebApp SDK: в обычном браузере всё превращается в no-op,
// чтобы миниапп можно было разрабатывать и тестировать без Telegram.
const tg = window.Telegram?.WebApp ?? null

export const isTelegram = Boolean(tg?.initData)

export function initTelegram() {
  if (!tg) return
  tg.ready()
  tg.expand()
  try {
    tg.setHeaderColor('#07090f')
    tg.setBackgroundColor('#07090f')
    tg.disableVerticalSwipes?.()
  } catch {
    // старые клиенты не поддерживают часть методов
  }
}

export function haptic(kind = 'light') {
  try {
    if (tg?.HapticFeedback) {
      if (kind === 'success') tg.HapticFeedback.notificationOccurred('success')
      else tg.HapticFeedback.impactOccurred(kind)
      return
    }
    // Вне Telegram (мобильный браузер) — обычная вибрация
    navigator.vibrate?.(kind === 'success' ? [30, 60, 30] : kind === 'medium' ? 20 : 10)
  } catch {
    /* noop */
  }
}

export function getUser() {
  return tg?.initDataUnsafe?.user ?? null
}

// --- BackButton: показываем на внутренних экранах ---
let backHandler = null

export function showBackButton(onBack) {
  if (!tg?.BackButton) return
  if (backHandler) tg.BackButton.offClick(backHandler)
  backHandler = onBack
  tg.BackButton.onClick(onBack)
  tg.BackButton.show()
}

export function hideBackButton() {
  if (!tg?.BackButton) return
  if (backHandler) {
    tg.BackButton.offClick(backHandler)
    backHandler = null
  }
  tg.BackButton.hide()
}

// --- CloudStorage: зеркалим прогресс, чтобы он жил между устройствами ---
export function cloudGet(key) {
  return new Promise((resolve) => {
    if (!tg?.CloudStorage) return resolve(null)
    try {
      tg.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value || null))
    } catch {
      resolve(null)
    }
  })
}

export function cloudSet(key, value) {
  try {
    tg?.CloudStorage?.setItem(key, value, () => {})
  } catch {
    /* noop */
  }
}
