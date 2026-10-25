import { describe, expect, it } from 'vitest'
import { farmFromTotal, farmTotal, mergeSaved } from './merge'
import { SAMPLE_LESSON } from '../data/sampleLesson'
import type { Saved } from '../state'

const empty: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }
const attempt = (id: string, lessonId: string, finishedAt: string | null) => ({ id, lessonId, subject: 'Mathe', topic: 'T', source: 'Übung', startedAt: '2026-10-20T10:00:00Z', finishedAt, stats: [] })

describe('Cloud: Stände zusammenführen', () => {
  it('rechnet den Bauernhof hin und zurück', () => {
    expect(farmFromTotal(farmTotal({ egg: 3, chick: 9, hen: 2, rooster: 0, cow: 1 }))).toEqual({ egg: 3, chick: 9, hen: 2, rooster: 0, cow: 1 })
    expect(farmFromTotal(10)).toEqual({ egg: 0, chick: 1, hen: 0, rooster: 0, cow: 0 })
  })
  it('verliert keine Aufgaben und keine Eier, wenn zwei Geräte getrennt lernen', () => {
    const handy: Saved = { ...empty, farm: { ...empty.farm, egg: 1 }, attempts: [attempt('a1', 'L1', '2026-10-20T10:05:00Z')], lessons: { L1: { ...SAMPLE_LESSON, id: 'L1' } } }
    const tablet: Saved = { ...empty, farm: { ...empty.farm, egg: 1 }, attempts: [attempt('a2', 'L2', '2026-10-20T11:05:00Z')], lessons: { L2: { ...SAMPLE_LESSON, id: 'L2' } } }
    const m = mergeSaved(handy, tablet)
    expect(m.attempts.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(Object.keys(m.lessons).sort()).toEqual(['L1', 'L2'])
    expect(m.farm.egg).toBe(2)
  })
  it('lässt den Bauernhof nie schrumpfen und behält das Stimmungs-Ei', () => {
    const old: Saved = { ...empty, farm: { ...empty.farm, chick: 2 }, mood: { '2026-10-20': { value: 50, at: '2026-10-20T08:00:00Z', egg: true } } }
    const next: Saved = { ...empty, mood: { '2026-10-20': { value: 80, at: '2026-10-20T09:00:00Z' } } }
    const m = mergeSaved(old, next)
    expect(m.farm.chick).toBe(2)
    expect(m.mood['2026-10-20'].egg).toBe(true)
  })
  it('übernimmt Archivieren vom neueren Stand, behält aber das Fertig-Datum', () => {
    const old: Saved = { ...empty, attempts: [attempt('a1', 'L1', '2026-10-20T10:05:00Z')] }
    const next: Saved = { ...empty, attempts: [{ ...attempt('a1', 'L1', null), archivedAt: '2026-10-21T08:00:00Z' }] }
    const a = mergeSaved(old, next).attempts[0]
    expect(a.finishedAt).toBe('2026-10-20T10:05:00Z')
    expect(a.archivedAt).toBe('2026-10-21T08:00:00Z')
  })
  it('behält gescannte Seiten und schon erstellte Lernpfade pro Aufgabe', () => {
    const task = (label: string) => ({ label, topic: 'Brüche', text: 'Kürze {4/8}.' })
    const page = { id: 'P1', at: '2026-10-25T10:00:00Z', subject: 'Mathe', title: 'Seite 42', tasks: [task('Aufgabe 1'), task('Aufgabe 2')] }
    const old: Saved = { ...empty, pages: { P1: { ...page, tasks: [{ ...task('Aufgabe 1'), lessonId: 'L1' }, task('Aufgabe 2')] } } }
    const next: Saved = { ...empty, pages: { P1: { ...page, tasks: [task('Aufgabe 1'), { ...task('Aufgabe 2'), lessonId: 'L2' }] }, P2: { ...page, id: 'P2' } } }
    const m = mergeSaved(old, next)
    expect(m.pages.P1.tasks.map((t) => t.lessonId)).toEqual(['L1', 'L2'])
    expect(Object.keys(m.pages).sort()).toEqual(['P1', 'P2'])
  })
  it('übernimmt nach einem Neustart nichts aus dem alten Stand', () => {
    const alt: Saved = { ...empty, farm: { ...empty.farm, chick: 3 }, attempts: [attempt('a1', 'L1', '2026-10-20T10:05:00Z')], lessons: { L1: { ...SAMPLE_LESSON, id: 'L1' } } }
    const neu: Saved = { ...empty, parentPin: '1234', start: '2026-10-25T12:00:00Z' }
    expect(mergeSaved(neu, alt)).toBe(neu)
    expect(mergeSaved(alt, neu)).toBe(neu)
    const weiter: Saved = { ...neu, attempts: [attempt('a2', 'L2', null)] }
    expect(mergeSaved(neu, weiter).attempts.map((a) => a.id)).toEqual(['a2'])
  })
})
