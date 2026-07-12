import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { initTelegram } from './lib/telegram'
import { syncFromCloud } from './lib/store'
import { initAccess } from './lib/access'
// Шрифты локально (@fontsource): без запросов к Google Fonts
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './app.css'

initTelegram()
syncFromCloud()
initAccess()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
