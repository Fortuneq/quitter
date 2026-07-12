import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import TabBar from './components/TabBar'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Plan from './pages/Plan'
import Lesson from './pages/Lesson'
import Panic from './pages/Panic'
import Stats from './pages/Stats'
import Paywall from './pages/Paywall'
import Profile from './pages/Profile'
import { getProgress } from './lib/store'
import { showBackButton, hideBackButton } from './lib/telegram'

// Внутренние экраны с кнопкой «назад» Telegram. Паника — со своим крестиком.
const INNER_PREFIXES = ['/lesson/', '/paywall', '/profile']

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const isInner = INNER_PREFIXES.some((p) => location.pathname.startsWith(p))
  const isPanic = location.pathname.startsWith('/panic')
  const isOnboarding = location.pathname.startsWith('/onboarding')
  const hideTabs = isPanic || isOnboarding

  useEffect(() => {
    if (isInner) showBackButton(() => navigate(-1))
    else hideBackButton()
    return hideBackButton
  }, [location.pathname, isInner, navigate])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Первый запуск — квиз
  const needsOnboarding = !getProgress().startedAt

  return (
    <div className="app">
      <main className={hideTabs ? 'screen screen--full' : 'screen'}>
        <Routes>
          <Route
            path="/"
            element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Today />}
          />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/lesson/:day" element={<Lesson />} />
          <Route path="/panic" element={<Panic />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideTabs && <TabBar />}
    </div>
  )
}
