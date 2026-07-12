// Дерево-метафора: растёт с каждым чистым днём (5 стадий до 60+ дней).
// Параметрический SVG: ствол тянется вверх, крона набирает объём.
export function treeStage(days) {
  if (days < 3) return 0 // росток
  if (days < 7) return 1 // побег
  if (days < 14) return 2 // саженец
  if (days < 30) return 3 // деревце
  if (days < 60) return 4 // дерево
  return 5 // цветущее
}

const STAGE_NAMES = ['Росток', 'Побег', 'Саженец', 'Деревце', 'Дерево', 'Цветущее дерево']

const LEAF = '#38e0a0'
const LEAF_DARK = '#1fae7a'
const TRUNK = '#8a6845'
const BLOOM = '#ffd166'

export default function Tree({ days }) {
  const stage = treeStage(days)
  return (
    <div className="tree">
      <svg viewBox="0 0 160 150" width="150" height="140" aria-hidden="true">
        {/* земля */}
        <ellipse cx="80" cy="138" rx="52" ry="9" fill="rgba(255,255,255,0.06)" />

        {stage === 0 && (
          <g>
            <path d="M80 138V120" stroke={LEAF_DARK} strokeWidth="4" strokeLinecap="round" />
            <path d="M80 122c-2-10-10-14-18-14 2 10 9 15 18 14Z" fill={LEAF} />
            <path d="M80 126c2-8 8-11 14-11-1 8-7 12-14 11Z" fill={LEAF_DARK} />
          </g>
        )}

        {stage === 1 && (
          <g>
            <path d="M80 138V96" stroke={TRUNK} strokeWidth="5" strokeLinecap="round" />
            <circle cx="80" cy="88" r="16" fill={LEAF} />
            <circle cx="66" cy="100" r="11" fill={LEAF_DARK} />
            <circle cx="94" cy="100" r="11" fill={LEAF_DARK} />
          </g>
        )}

        {stage === 2 && (
          <g>
            <path d="M80 138V80" stroke={TRUNK} strokeWidth="6" strokeLinecap="round" />
            <path d="M80 106c-8-4-16-4-22-1" stroke={TRUNK} strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="80" cy="70" r="21" fill={LEAF} />
            <circle cx="60" cy="84" r="14" fill={LEAF_DARK} />
            <circle cx="100" cy="84" r="14" fill={LEAF_DARK} />
            <circle cx="52" cy="102" r="9" fill={LEAF} />
          </g>
        )}

        {stage === 3 && (
          <g>
            <path d="M80 138V62" stroke={TRUNK} strokeWidth="7" strokeLinecap="round" />
            <path d="M80 96c-10-6-20-6-27-2M80 84c9-6 18-6 25-3" stroke={TRUNK} strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="80" cy="52" r="25" fill={LEAF} />
            <circle cx="55" cy="70" r="17" fill={LEAF_DARK} />
            <circle cx="105" cy="70" r="17" fill={LEAF_DARK} />
            <circle cx="70" cy="86" r="12" fill={LEAF} />
            <circle cx="92" cy="86" r="12" fill={LEAF} />
          </g>
        )}

        {stage >= 4 && (
          <g>
            <path d="M80 138V52" stroke={TRUNK} strokeWidth="8" strokeLinecap="round" />
            <path d="M80 92c-12-8-24-8-32-3M80 76c11-8 22-8 30-4M80 106c-8-4-14-4-20-2" stroke={TRUNK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <circle cx="80" cy="40" r="27" fill={LEAF} />
            <circle cx="50" cy="58" r="19" fill={LEAF_DARK} />
            <circle cx="110" cy="58" r="19" fill={LEAF_DARK} />
            <circle cx="62" cy="78" r="15" fill={LEAF} />
            <circle cx="98" cy="78" r="15" fill={LEAF} />
            <circle cx="80" cy="66" r="16" fill={LEAF} />
            {stage === 5 && (
              <g fill={BLOOM}>
                <circle cx="68" cy="38" r="3.5" />
                <circle cx="94" cy="46" r="3.5" />
                <circle cx="80" cy="58" r="3.5" />
                <circle cx="55" cy="66" r="3.5" />
                <circle cx="108" cy="70" r="3.5" />
                <circle cx="70" cy="80" r="3.5" />
              </g>
            )}
          </g>
        )}
      </svg>
      <span className="tree__stage">{STAGE_NAMES[stage]}</span>
    </div>
  )
}
