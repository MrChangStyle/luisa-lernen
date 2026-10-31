import type { Visual } from '../types'

// Mengenbilder für die Hilfe „Zahlen mit Bild“: Zehnerfeld, Zahlenstrahl, Stellenwerttafel.
// Ruhige Farben, keine Animation. Zeigen nur Zahlen aus der Aufgabe, nie das Ergebnis.

export function VisualView({ v }: { v: Visual }) {
  if (v.kind === 'zehnerfeld') return <TenFrames n={v.zahl} />
  if (v.kind === 'zahlenstrahl') return <NumberLine {...v} />
  return <PlaceValue numbers={v.zahlen} />
}

// Punkte in Zehnerfeldern (2 Reihen à 5, „Kraft der Fünf“), damit man Mengen ohne Abzählen erfasst
function TenFrames({ n }: { n: number }) {
  const count = Math.max(0, Math.min(100, Math.round(n)))
  const frames = Math.max(1, Math.ceil(count / 10))
  return (
    <figure className="visual" aria-label={`${count} Punkte in Zehnerfeldern`}>
      <div className="tenframes">
        {Array.from({ length: frames }, (_, f) => (
          <svg key={f} viewBox="0 0 106 44" width="106" height="44" aria-hidden="true">
            <rect x="1" y="1" width="104" height="42" rx="4" fill="none" stroke="currentColor" strokeOpacity=".35" />
            {Array.from({ length: 10 }, (_, i) => {
              const on = f * 10 + i < count
              const x = 11 + (i % 5) * 21
              const y = i < 5 ? 12 : 32
              return <circle key={i} cx={x} cy={y} r="7" className={on ? 'dot on' : 'dot'} />
            })}
          </svg>
        ))}
      </div>
      <figcaption>{count}</figcaption>
    </figure>
  )
}

function NumberLine({ von, bis, schritt, markiert }: { von: number; bis: number; schritt: number; markiert: number[] }) {
  const ticks = Math.floor((bis - von) / schritt)
  if (ticks < 1 || ticks > 20) return null
  const W = 320
  const x = (n: number) => 14 + ((n - von) / (bis - von)) * (W - 28)
  return (
    <figure className="visual" aria-label={`Zahlenstrahl von ${von} bis ${bis}${markiert.length ? `, markiert: ${markiert.join(', ')}` : ''}`}>
      <svg viewBox={`0 0 ${W} 58`} width="100%" style={{ maxWidth: W }} aria-hidden="true">
        <line x1="8" y1="20" x2={W - 8} y2="20" stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const n = von + i * schritt
          const label = i === 0 || i === ticks || ticks <= 10
          return (
            <g key={i}>
              <line x1={x(n)} y1="13" x2={x(n)} y2="27" stroke="currentColor" />
              {label && (
                <text x={x(n)} y="44" textAnchor="middle" fontSize="11" fill="currentColor">
                  {n}
                </text>
              )}
            </g>
          )
        })}
        {markiert
          .filter((m) => m >= von && m <= bis)
          .map((m) => (
            <g key={m}>
              <circle cx={x(m)} cy="20" r="6" className="dot on" />
              <text x={x(m)} y="8" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">
                {m}
              </text>
            </g>
          ))}
      </svg>
    </figure>
  )
}

function PlaceValue({ numbers }: { numbers: number[] }) {
  const cols = ['T', 'H', 'Z', 'E']
  const wide = numbers.some((n) => n >= 1000)
  const shown = wide ? cols : cols.slice(1)
  return (
    <figure className="visual" aria-label={`Stellenwerttafel mit ${numbers.join(', ')}`}>
      <table className="placevalue">
        <thead>
          <tr>
            {shown.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {numbers.map((n, r) => {
            const digits = String(Math.floor(n)).padStart(shown.length, ' ').slice(-shown.length).split('')
            return (
              <tr key={r}>
                {digits.map((d, i) => (
                  <td key={i}>{d.trim()}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </figure>
  )
}
