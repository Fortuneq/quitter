import { NavLink } from 'react-router-dom'
import { haptic } from '../lib/telegram'
import { FlameIcon, MapIcon, SosIcon, StatsIcon, UserIcon } from './Icons'

const tabs = [
  { to: '/', label: 'Сегодня', Icon: FlameIcon },
  { to: '/plan', label: 'План', Icon: MapIcon },
  { to: '/panic', label: 'SOS', Icon: SosIcon, panic: true },
  { to: '/stats', label: 'Статистика', Icon: StatsIcon },
  { to: '/profile', label: 'Профиль', Icon: UserIcon },
]

export default function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map(({ to, label, Icon, panic }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `tabbar__item${panic ? ' tabbar__item--panic' : ''}${isActive ? ' is-active' : ''}`
          }
          onClick={() => haptic(panic ? 'medium' : 'light')}
          aria-label={label}
        >
          <Icon />
        </NavLink>
      ))}
    </nav>
  )
}
