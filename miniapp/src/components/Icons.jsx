// Иконки — inline SVG, stroke по currentColor
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function FlameIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.5c.6 3-1 4.5-2.5 6C7.7 10.3 6 12.2 6 15a6 6 0 0 0 12 0c0-4.5-3.5-6.5-3.5-9.5-1 .8-1.7 2-1.6 3.5C11.5 6.8 11.4 4.5 12 2.5Z" />
      <path d="M12 21a3.5 3.5 0 0 1-3.5-3.5c0-1.8 1.4-2.8 2.3-3.9.5-.6.9-1.3 1-2.1 1.5 1.4 3.7 3.2 3.7 6A3.5 3.5 0 0 1 12 21Z" />
    </svg>
  )
}

export function MapIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

export function SosIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3.5 18.5a1.6 1.6 0 0 0 1.4 2.4h14.2a1.6 1.6 0 0 0 1.4-2.4L12 3Z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17.2" r="0.4" fill="currentColor" />
    </svg>
  )
}

export function StatsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3.5" />
    </svg>
  )
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.5-3.4 4.2-5 7.5-5s6 1.6 7.5 5" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ChevronIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </svg>
  )
}
