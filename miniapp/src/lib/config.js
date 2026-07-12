// Имя бота задаётся при сборке (см. miniapp/Dockerfile, VITE_BOT_USERNAME);
// плейсхолдер — до создания бота в BotFather.
export const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? 'quitter_reboot_bot'
export const BOT_LINK = `https://t.me/${BOT_USERNAME}`
