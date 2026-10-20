import { useState } from 'react'
import type { DayBar } from '../logic/stats'
import { moodText } from '../logic/mood'

// Schlichte Wochendiagramme für den Familienbereich: eine Reihe, eine Farbe, kein Legendenkasten.
// Ein Tipp (oder Hover) auf einen Tag zeigt seine Werte unter dem Diagramm.

const W = 320
const LEFT = 52
const COL = (W - LEFT) / 7

const moodWord = (v: number) => moodText(v).replace('Mir geht es ', '').replace('.', '')

function DayDetail({ day, avg }: { day: DayBar; avg: boolean }) {
  return (
    <p className="mini chart-detail" role="status">
      <b>
        {day.label} {day.sub}
      </b>
      {avg ? ' (alle Wochen zusammen)' : ''}: {day.tasks} {day.tasks === 1 ? 'Aufgabe' : 'Aufgaben'} fertig
      {day.minutes > 0 && `, ${day.minutes} Min. Lernzeit`}
      {`, Stimmung: ${day.mood === null ? 'nicht eingetragen' : `${moodWord(day.mood)}${avg ? ' (Ø)' : ''}`}`}
    </p>
  )
}

function DayAxis({ days, y, pick, picked }: { days: DayBar[]; y: number; pick: (i: number) => void; picked: number | null }) {
  return (
    <>
      {days.map((d, i) => (
        <g key={i}>
          <text x={LEFT + COL * i + COL / 2} y={y} className={`ax${picked === i ? ' on' : ''}`} textAnchor="middle">
            {d.label}
          </text>
          {d.sub && (
            <text x={LEFT + COL * i + COL / 2} y={y + 13} className="ax small" textAnchor="middle">
              {d.sub}
            </text>
          )}
          <rect x={LEFT + COL * i} y={0} width={COL} height={y + 16} fill="transparent" onClick={() => pick(i)} onMouseEnter={() => pick(i)}>
            <title>{`${d.label} ${d.sub}: ${d.tasks} Aufgaben${d.mood === null ? '' : `, Stimmung ${moodWord(d.mood)}`}`}</title>
          </rect>
        </g>
      ))}
    </>
  )
}

export function TaskBars({ days, avg }: { days: DayBar[]; avg: boolean }) {
  const [picked, setPicked] = useState<number | null>(null)
  const top = 18
  const base = 104
  const max = Math.max(1, ...days.map((d) => d.tasks))
  const bw = Math.min(26, COL - 10)
  return (
    <figure className="chart">
      <figcaption className="chart-title">Fertige Aufgaben {avg ? 'je Wochentag' : 'pro Tag'}</figcaption>
      <svg viewBox={`0 0 ${W} ${base + 32}`} role="img" aria-label={`Fertige Aufgaben: ${days.map((d) => `${d.label} ${d.tasks}`).join(', ')}`}>
        <line x1={LEFT} x2={W} y1={base} y2={base} className="grid base" />
        <text x={LEFT - 8} y={base} className="ax" textAnchor="end" dominantBaseline="middle">
          0
        </text>
        <text x={LEFT - 8} y={top} className="ax" textAnchor="end" dominantBaseline="middle">
          {max}
        </text>
        <line x1={LEFT} x2={W} y1={top} y2={top} className="grid" />
        {days.map((d, i) => {
          if (!d.tasks) return null
          const h = ((base - top) * d.tasks) / max
          const x = LEFT + COL * i + (COL - bw) / 2
          const r = Math.min(4, h / 2)
          return (
            <g key={i} className={picked === i ? 'bar on' : 'bar'}>
              <path d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + bw - r} Q${x + bw},${base - h} ${x + bw},${base - h + r} V${base} Z`} />
              <text x={x + bw / 2} y={base - h - 5} className="val" textAnchor="middle">
                {d.tasks}
              </text>
            </g>
          )
        })}
        <DayAxis days={days} y={base + 15} pick={setPicked} picked={picked} />
      </svg>
      {picked !== null && <DayDetail day={days[picked]} avg={avg} />}
    </figure>
  )
}

export function MoodLine({ days, avg }: { days: DayBar[]; avg: boolean }) {
  const [picked, setPicked] = useState<number | null>(null)
  const top = 12
  const base = 100
  const yOf = (v: number) => base - ((base - top) * v) / 100
  const pts = days.map((d, i) => (d.mood === null ? null : { x: LEFT + COL * i + COL / 2, y: yOf(d.mood), i }))
  // Linie nur zwischen Tagen, die direkt aufeinander folgen
  const segs: string[] = []
  pts.forEach((p, i) => {
    const q = pts[i + 1]
    if (p && q) segs.push(`M${p.x},${p.y} L${q.x},${q.y}`)
  })
  return (
    <figure className="chart">
      <figcaption className="chart-title">Stimmung {avg ? 'je Wochentag (Durchschnitt)' : 'pro Tag'}</figcaption>
      <svg viewBox={`0 0 ${W} ${base + 32}`} role="img" aria-label={`Stimmung: ${days.map((d) => `${d.label} ${d.mood === null ? 'keine Angabe' : moodWord(d.mood)}`).join(', ')}`}>
        {[
          [100, 'sehr gut'],
          [50, 'es geht'],
          [0, 'schlecht'],
        ].map(([v, t]) => (
          <g key={t}>
            <line x1={LEFT} x2={W} y1={yOf(v as number)} y2={yOf(v as number)} className={v === 0 ? 'grid base' : 'grid'} />
            <text x={LEFT - 8} y={yOf(v as number)} className="ax" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {segs.map((d, i) => (
          <path key={i} d={d} className="mood-line" />
        ))}
        {pts.map((p) => p && <circle key={p.i} cx={p.x} cy={p.y} r={picked === p.i ? 6 : 4.5} className="mood-dot" />)}
        <DayAxis days={days} y={base + 15} pick={setPicked} picked={picked} />
      </svg>
      {picked !== null && <DayDetail day={days[picked]} avg={avg} />}
    </figure>
  )
}
