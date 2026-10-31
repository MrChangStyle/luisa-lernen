import { describe, expect, it } from 'vitest'
import { easierLearner, easierLesson, hardTopics, preferredVersion, withFirst } from '../src/logic/adapt'
import { SAMPLE_LESSON } from '../src/data/sampleLesson'
import type { Attempt, PackLesson, PackTopic, Saved, StepStat } from '../src/types'

const base: Saved = { farm: { egg: 0, chick: 0, hen: 0, rooster: 0, cow: 0 }, mood: {}, selection: [], attempts: [], events: [], parentPin: null, lessons: {}, donePractice: [], pages: {} }
let n = 0
const attempt = (topic: string, stats: Partial<StepStat>[], extra: Partial<Attempt> = {}): Attempt => ({
  id: `a${++n}`,
  lessonId: `l-${topic}`,
  subject: 'Mathe',
  topic,
  source: '',
  startedAt: `2026-10-${String(10 + n).padStart(2, '0')}T10:00:00Z`,
  finishedAt: null,
  stats: stats.map((s) => ({ again: 0, wrong: [], helped: null, ...s })),
  ...extra,
})

describe('Die App lernt pro Kind', () => {
  it('bevorzugt eine Erklärung erst, wenn sie klar am häufigsten hilft', () => {
    expect(preferredVersion({ ...base, attempts: [attempt('A', [{ helped: 'bild' }, { helped: 'bild' }])] })).toBeNull()
    const s = { ...base, attempts: [attempt('A', [{ helped: 'bild' }, { helped: 'bild' }, { helped: 'worte' }])] }
    expect(preferredVersion(s)).toEqual({ key: 'bild', count: 2, total: 3 })
    const even = { ...base, attempts: [attempt('A', [{ helped: 'bild' }, { helped: 'worte' }, { helped: 'regel' }, { helped: 'leicht' }])] }
    expect(preferredVersion(even)).toBeNull()
  })

  it('zeigt die bevorzugte Erklärung zuerst, ohne eine zu verlieren', () => {
    const l = withFirst(SAMPLE_LESSON, 'regel')
    l.steps.forEach((st, i) => {
      expect(st.versions[0].key).toBe('regel')
      expect(st.versions).toHaveLength(SAMPLE_LESSON.steps[i].versions.length)
    })
    expect(withFirst(SAMPLE_LESSON, null)).toBe(SAMPLE_LESSON)
  })

  it('merkt sich Themen, bei denen das Kind nicht weiterkam; archivierte zählen nicht', () => {
    const s = {
      ...base,
      attempts: [attempt('Brüche', [{ stuck: 1 }]), attempt('Runden', [{}]), attempt('Zeit', [{ stuck: 2 }], { archivedAt: '2026-10-30T00:00:00Z' })],
    }
    expect(hardTopics(s)).toEqual(['Brüche'])
  })

  it('macht die KI-Aufgabe leichter und wählt im Paket eine leichtere Stufe', () => {
    expect(easierLearner({ name: 'Ben', grade: 3, school: 'Grundschule', helps: ['woertlich'] }).helps).toEqual(['woertlich', 'kleineSchritte', 'zahlenBild', 'leichteSprache'])
    const mk = (id: string, level: 1 | 2 | 3): PackLesson => ({ ...SAMPLE_LESSON, id, level })
    const topic: PackTopic = { name: 'T', area: 'A', lessons: [mk('x3', 3), mk('x1', 1), mk('x2', 2)] }
    expect(easierLesson(topic, base, mk('x2', 2))?.id).toBe('x1')
    expect(easierLesson({ ...topic, lessons: [mk('x1', 1)] }, base, mk('x1', 1))).toBeNull()
  })
})
