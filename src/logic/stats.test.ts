import { describe, expect, it } from 'vitest'
import { periodLabel, periodOptions, summarize, weekStart } from './stats'
import type { Saved } from '../types'

const base: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }
const done = (id: string, start: string, end: string | null) => ({ id, lessonId: id, subject: 'Mathe', topic: 'T', source: 'Übung', startedAt: start, finishedAt: end, stats: [] })

describe('Übersicht im Familienbereich', () => {
  const s: Saved = {
    ...base,
    attempts: [
      done('a', '2026-10-19T15:00:00', '2026-10-19T15:12:00'), // Montag, 12 Minuten
      done('b', '2026-10-19T16:00:00', '2026-10-19T19:00:00'), // Montag, auf 60 Minuten begrenzt
      done('c', '2026-10-21T10:00:00', null), // nicht fertig, zählt nicht
      done('d', '2026-10-13T10:00:00', '2026-10-13T10:05:00'), // Vorwoche, Dienstag
    ],
    mood: { '2026-10-19': { value: 80, at: '2026-10-19T08:00:00' }, '2026-10-20': { value: 40, at: '2026-10-20T08:00:00' } },
  }
  it('beginnt Wochen am Montag und beschriftet sie mit KW', () => {
    expect(weekStart(new Date(2026, 9, 25))).toBe('2026-10-19')
    expect(periodLabel({ kind: 'week', start: '2026-10-19' })).toBe('KW 43 · 19.10.–25.10.')
  })
  it('zählt fertige Aufgaben, Lernzeit und Ø Stimmung einer Woche', () => {
    const r = summarize(s, { kind: 'week', start: '2026-10-19' })
    expect(r.tasks).toBe(2)
    expect(r.minutes).toBe(72)
    expect(r.mood).toBe(60)
    expect(r.days.map((d) => d.tasks)).toEqual([2, 0, 0, 0, 0, 0, 0])
    expect(r.days[1].mood).toBe(40)
  })
  it('fasst bei „Gesamt“ je Wochentag zusammen', () => {
    const r = summarize(s, { kind: 'all' })
    expect(r.tasks).toBe(3)
    expect(r.days.map((d) => d.tasks)).toEqual([2, 1, 0, 0, 0, 0, 0])
  })
  it('bietet Wochen seit dem ersten Eintrag, Monate und Gesamt an', () => {
    const o = periodOptions(s, new Date(2026, 9, 20))
    expect(o.map((p) => (p.kind === 'week' ? p.start : p.kind === 'month' ? p.month : 'all'))).toEqual(['2026-10-19', '2026-10-12', '2026-10', 'all'])
  })
})
