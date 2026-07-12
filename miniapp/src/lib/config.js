// Имя бота задаётся при сборке (см. miniapp/Dockerfile, VITE_BOT_USERNAME)
export const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'quitrobot'
export const BOT_LINK = `https://t.me/${BOT_USERNAME}`
