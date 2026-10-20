import type { Animal } from '../logic/farm'

// Alle Zeichnungen der App. Feste Farben, weil es Bilder sind und in hellem wie dunklem Modus gleich aussehen sollen.

export function Face({ value, size = 110 }: { value: number; size?: number }) {
  const m = value / 100
  const my = 70 + (m - 0.5) * 46
  const inner = 33 + (1 - m) * 9 - m * 3
  const hue = 8 + m * 38
  const open = m > 0.72
  const t = Math.max(0, (m - 0.8) / 0.2)
  const tongue = 74 + 14 * t
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible" role="img" aria-label="Stimmungsgesicht">
      <circle cx="50" cy="50" r="44" fill={`hsl(${hue} 85% 68%)`} stroke="#3a3a3a" strokeWidth="2" />
      <path d={`M26 ${33 - m * 4} L42 ${inner}`} stroke="#3a3a3a" strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M74 ${33 - m * 4} L58 ${inner}`} stroke="#3a3a3a" strokeWidth="3.5" strokeLinecap="round" />
      {m > 0.6 && (
        <g opacity={(m - 0.6) * 1.6} fill="#e8707a">
          <ellipse cx="24" cy="58" rx="7" ry="4.5" />
          <ellipse cx="76" cy="58" rx="7" ry="4.5" />
        </g>
      )}
      {m > 0.86 ? (
        <g stroke="#2a2a2a" strokeWidth="3.5" fill="none" strokeLinecap="round">
          <path d="M29 46 Q35 37 41 46" />
          <path d="M59 46 Q65 37 71 46" />
        </g>
      ) : (
        <g fill="#2a2a2a">
          <circle cx="35" cy="44" r="5" />
          <circle cx="65" cy="44" r="5" />
        </g>
      )}
      {open ? (
        <>
          <path d={`M27 64 Q50 ${my + 8} 73 64 Z`} fill="#5a1f1f" stroke="#3a3a3a" strokeWidth="3" strokeLinejoin="round" />
          {t > 0 && (
            <>
              <path
                d={`M47 72 L47 ${tongue} Q47 ${tongue + 8} 56 ${tongue + 8} Q65 ${tongue + 8} 65 ${tongue} L65 72 Z`}
                fill="#ef7b8a"
                stroke="#3a3a3a"
                strokeWidth="2"
              />
              <path d={`M56 74 L56 ${76 + 10 * t}`} stroke="#c4505f" strokeWidth="1.6" />
            </>
          )}
        </>
      ) : (
        <path d={`M30 70 Q50 ${my} 70 70`} stroke="#3a3a3a" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}

export function Henni({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.125} viewBox="0 0 64 72" aria-hidden="true">
      <path d="M10 40 L2 30 L14 36 Z" fill="#b0824a" />
      <ellipse cx="28" cy="50" rx="20" ry="15" fill="#f2efe6" stroke="#6b5a3a" strokeWidth="1.4" />
      <path d="M18 46 Q26 54 36 46" stroke="#c9bfa6" strokeWidth="2" fill="none" />
      <circle cx="42" cy="30" r="12" fill="#f2efe6" stroke="#6b5a3a" strokeWidth="1.4" />
      <path d="M36 19 Q39 12 42 17 Q45 11 48 18 Z" fill="#d6403a" />
      <path d="M31 15 L45 10 L59 15 L45 20 Z" fill="#2f3b3c" />
      <path d="M57 15 L58 24" stroke="#e0b46a" strokeWidth="1.5" />
      <circle cx="58" cy="25" r="1.8" fill="#e0b46a" />
      <g fill="none" stroke="#2a2a2a" strokeWidth="1.4">
        <circle cx="39" cy="30" r="4.2" />
        <circle cx="48" cy="30" r="4.2" />
        <path d="M43.2 30 L43.8 30" />
      </g>
      <circle cx="39" cy="30" r="1.4" fill="#2a2a2a" />
      <circle cx="48" cy="30" r="1.4" fill="#2a2a2a" />
      <path d="M52 34 L60 36 L52 38 Z" fill="#e08a1e" />
      <path d="M44 40 Q42 38 44 37" stroke="#d6403a" strokeWidth="3" fill="none" />
      <path d="M46 52 L62 40" stroke="#8a5a2a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 64 L22 70 M32 64 L32 70" stroke="#e08a1e" strokeWidth="2.2" />
    </svg>
  )
}

export function AnimalIcon({ kind }: { kind: Animal }) {
  switch (kind) {
    case 'egg':
      return (
        <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
          <ellipse cx="14" cy="17" rx="10" ry="13" fill="#f4e7c9" stroke="#8a7650" strokeWidth="1.5" />
        </svg>
      )
    case 'chick':
      return (
        <svg width="34" height="32" viewBox="0 0 34 32" aria-hidden="true">
          <ellipse cx="16" cy="21" rx="11" ry="9" fill="#f5cf4a" stroke="#9b7a14" strokeWidth="1.2" />
          <circle cx="23" cy="11" r="7" fill="#f5cf4a" stroke="#9b7a14" strokeWidth="1.2" />
          <circle cx="25" cy="10" r="1.3" fill="#2a2a2a" />
          <path d="M29 12 L33 13 L29 14 Z" fill="#e08a1e" />
        </svg>
      )
    case 'hen':
      return (
        <svg width="46" height="44" viewBox="0 0 46 44" aria-hidden="true">
          <path d="M6 18 L2 10 L10 15 Z" fill="#b0824a" />
          <ellipse cx="20" cy="28" rx="15" ry="11" fill="#c98f52" stroke="#7a4e22" strokeWidth="1.2" />
          <circle cx="32" cy="15" r="8" fill="#c98f52" stroke="#7a4e22" strokeWidth="1.2" />
          <path d="M28 7 Q30 2 32 6 Q34 2 36 7 Z" fill="#d6403a" />
          <circle cx="34" cy="14" r="1.4" fill="#2a2a2a" />
          <path d="M39 15 L44 17 L39 18 Z" fill="#e08a1e" />
          <path d="M16 39 L16 43 M24 39 L24 43" stroke="#e08a1e" strokeWidth="2" />
        </svg>
      )
    case 'rooster':
      return (
        <svg width="58" height="56" viewBox="0 0 58 56" aria-hidden="true">
          <path d="M10 30 Q0 10 8 4 Q12 18 16 22 Q12 8 20 6 Q20 18 22 24 Z" fill="#2f6f73" />
          <path d="M6 24 Q2 14 12 12 Q12 22 16 26 Z" fill="#3f8f5a" />
          <ellipse cx="26" cy="36" rx="16" ry="12" fill="#a5482c" stroke="#5e2614" strokeWidth="1.2" />
          <circle cx="40" cy="20" r="9" fill="#c45a33" stroke="#5e2614" strokeWidth="1.2" />
          <path d="M33 12 Q35 3 38 9 Q40 2 43 9 Q46 4 47 12 Z" fill="#d6403a" />
          <path d="M41 28 Q43 34 39 33 Z" fill="#d6403a" />
          <circle cx="43" cy="18" r="1.5" fill="#2a2a2a" />
          <path d="M48 20 L54 22 L48 23 Z" fill="#e08a1e" />
          <path d="M22 47 L22 54 M30 47 L30 54" stroke="#e08a1e" strokeWidth="2.2" />
        </svg>
      )
    case 'cow':
      return (
        <svg width="64" height="50" viewBox="0 0 64 50" aria-hidden="true">
          <rect x="8" y="14" width="40" height="22" rx="9" fill="#f7f5ef" stroke="#3a3a3a" strokeWidth="1.4" />
          <path d="M16 15 Q22 22 18 30 Q12 26 12 18 Z" fill="#3a3a3a" />
          <path d="M32 15 Q40 20 36 28 Q30 24 30 16 Z" fill="#3a3a3a" />
          <g fill="#3a3a3a">
            <rect x="12" y="34" width="4" height="13" />
            <rect x="20" y="34" width="4" height="13" />
            <rect x="36" y="34" width="4" height="13" />
            <rect x="42" y="34" width="4" height="13" />
          </g>
          <path d="M8 18 Q2 24 5 32" stroke="#3a3a3a" strokeWidth="1.6" fill="none" />
          <rect x="44" y="6" width="16" height="18" rx="7" fill="#f7f5ef" stroke="#3a3a3a" strokeWidth="1.4" />
          <rect x="46" y="17" width="13" height="8" rx="4" fill="#e9a9a4" />
          <circle cx="49" cy="12" r="1.4" fill="#2a2a2a" />
          <circle cx="56" cy="12" r="1.4" fill="#2a2a2a" />
          <path d="M45 7 L42 2 M59 7 L62 2" stroke="#8a7650" strokeWidth="2" />
        </svg>
      )
  }
}

export function Pizza({ slices, filled }: { slices: number; filled: number }) {
  const paths = Array.from({ length: slices }, (_, i) => {
    const a0 = (i / slices) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / slices) * 2 * Math.PI - Math.PI / 2
    const p = (a: number) => `${(38 * Math.cos(a)).toFixed(2)} ${(38 * Math.sin(a)).toFixed(2)}`
    return <path key={i} d={`M0 0 L${p(a0)} A38 38 0 0 1 ${p(a1)} Z`} fill={i < filled ? '#d99a3a' : '#f6ecd9'} stroke="#3a3a3a" strokeWidth="1.5" />
  })
  return (
    <svg width="84" height="84" viewBox="-42 -42 84 84" aria-hidden="true">
      {paths}
    </svg>
  )
}
