import type { Saved } from '../types'
import { dayKey } from './mood'

// Zahlen für die Übersicht im Familienbereich. Das Diagramm zeigt immer eine Woche (Mo–So):
// bei „Woche“ die Tage dieser Woche, bei „Monat“ und „Gesamt“ die Summe bzw. den Durchschnitt je Wochentag.

export type Period = { kind: 'week'; start: string } | { kind: 'month'; month: string } | { kind: 'all' }

export interface DayBar {
  label: string
  sub: string
  tasks: number
  minutes: number
  mood: number | null
}

export interface Summary {
  tasks: number
  minutes: number
  mood: number | null
  moodDays: number
  days: DayBar[]
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MAX_MINUTES = 60 // längere Pausen zählen nicht als Lernzeit

const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (key: string, n: number) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}
export const weekStart = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return dayKey(x)
}
const weekdayIndex = (key: string) => (parseDay(key).getDay() + 6) % 7
const short = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}.`

// ISO-Kalenderwoche für die Beschriftung
function isoWeek(key: string) {
  const d = parseDay(key)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export function periodLabel(p: Period) {
  if (p.kind === 'all') return 'Gesamte Zeit'
  if (p.kind === 'month') return `${MONTHS[Number(p.month.slice(5, 7)) - 1]} ${p.month.slice(0, 4)}`
  return `KW ${isoWeek(p.start)} · ${short(p.start)}–${short(addDays(p.start, 6))}`
}

export const periodKey = (p: Period) => (p.kind === 'all' ? 'all' : p.kind === 'week' ? `w:${p.start}` : `m:${p.month}`)
export const parsePeriod = (k: string): Period => (k === 'all' ? { kind: 'all' } : k.startsWith('w:') ? { kind: 'week', start: k.slice(2) } : { kind: 'month', month: k.slice(2) })

// Alle Tage, an denen etwas passiert ist (Aufgabe begonnen oder Stimmung eingetragen)
function activeDays(s: Saved, today: Date) {
  const days = new Set<string>([dayKey(today)])
  for (const a of s.attempts) days.add(dayKey(new Date(a.startedAt)))
  for (const d of Object.keys(s.mood)) days.add(d)
  return [...days].sort()
}

// Auswahl für den Filter: alle Wochen und Monate seit dem ersten Eintrag, neueste zuerst, dann „Gesamt“
export function periodOptions(s: Saved, today = new Date()): Period[] {
  const days = activeDays(s, today)
  const weeks: Period[] = []
  for (let w = weekStart(today); w >= weekStart(parseDay(days[0])); w = addDays(w, -7)) weeks.push({ kind: 'week', start: w })
  const months = [...new Set(days.map((d) => d.slice(0, 7)))].sort().reverse().map((month): Period => ({ kind: 'month', month }))
  return [...weeks, ...months, { kind: 'all' }]
}

const inPeriod = (p: Period, key: string) =>
  p.kind === 'all' ? true : p.kind === 'month' ? key.startsWith(p.month) : key >= p.start && key <= addDays(p.start, 6)

export function summarize(s: Saved, p: Period): Summary {
  const days: DayBar[] = WEEKDAYS.map((label, i) => ({
    label,
    sub: p.kind === 'week' ? short(addDays(p.start, i)) : '',
    tasks: 0,
    minutes: 0,
    mood: null,
  }))
  let tasks = 0
  let minutes = 0
  for (const a of s.attempts) {
    if (!a.finishedAt) continue
    const key = dayKey(new Date(a.finishedAt))
    if (!inPeriod(p, key)) continue
    const m = Math.min(MAX_MINUTES, Math.max(1, Math.round((Date.parse(a.finishedAt) - Date.parse(a.startedAt)) / 60000)))
    tasks++
    minutes += m
    days[weekdayIndex(key)].tasks++
    days[weekdayIndex(key)].minutes += m
  }
  const moodSums = WEEKDAYS.map(() => ({ sum: 0, n: 0 }))
  let moodSum = 0
  let moodDays = 0
  for (const [key, m] of Object.entries(s.mood)) {
    if (!inPeriod(p, key)) continue
    moodSum += m.value
    moodDays++
    moodSums[weekdayIndex(key)].sum += m.value
    moodSums[weekdayIndex(key)].n++
  }
  moodSums.forEach((x, i) => (days[i].mood = x.n ? Math.round(x.sum / x.n) : null))
  return { tasks, minutes, mood: moodDays ? Math.round(moodSum / moodDays) : null, moodDays, days }
}
