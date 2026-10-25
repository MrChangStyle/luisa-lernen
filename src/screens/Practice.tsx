import { useState } from 'react'
import { Inline } from '../components/Rich'
import { move } from '../logic/selection'
import { Screen } from '../components/Ui'
import { SUBJECTS } from '../data/subjects'
import type { Lesson, Page } from '../types'
import type { Attempt, LessonEntry } from '../state'

interface MenuProps {
  selection: string[]
  openCount: number
  photoCount: number
  lessonCount: number
  onSubject: (s: string) => void
  go: (s: 'selection' | 'open' | 'photos' | 'lessons' | 'home') => void
}

export function PracticeMenu({ selection, openCount, photoCount, lessonCount, onSubject, go }: MenuProps) {
  const item = (to: 'selection' | 'open' | 'photos' | 'lessons', title: string, sub: string, n: number) => (
    <button className="card tap" onClick={() => go(to)}>
      <span className="row-between">
        <b>{title}</b>
        <span className="pill idle">{n}</span>
      </span>
      <span className="mini">{sub}</span>
    </button>
  )
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={() => go('home')}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Meine Übungen</div>
      <p className="q">Wähle ein Fach:</p>
      <div className="grid2">
        {Object.entries(SUBJECTS).map(([name, topics]) => (
          <button key={name} className="card tap" onClick={() => onSubject(name)}>
            <b>{name}</b>
            <span className="mini">
              {topics.length} Themen{topics.some((t) => selection.includes(t.name)) ? ' · ✓ ausgewählt' : ''}
            </span>
          </button>
        ))}
      </div>
      <p className="q">Oder:</p>
      {item('selection', 'Meine Auswahl', 'Themen, die du selbst ausgesucht hast', selection.length)}
      {item('open', 'Offene Übungen', 'Neue Aufgaben zu dem, was du fertig gemacht hast', openCount)}
      {item('lessons', 'Meine Aufgaben', 'Alle Aufgaben von Henni, offene und bestandene', lessonCount)}
      {item('photos', 'Aus meinen Fotos', 'Alle Themen, die du schon fotografiert hast', photoCount)}
    </Screen>
  )
}

interface SubjectProps {
  subject: string
  selection: string[]
  practiced: Set<string>
  onStart: (topic: string) => void
  onToggle: (t: string) => void
  onSubject: (s: string) => void
  onBack: () => void
}

export function SubjectScreen({ subject, selection, practiced, onStart, onToggle, onSubject, onBack }: SubjectProps) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">{subject}</div>
      <div className="chips tabs" role="tablist">
        {Object.keys(SUBJECTS).map((k) => (
          <button key={k} role="tab" aria-selected={k === subject} className={`chip small${k === subject ? ' on' : ''}`} onClick={() => onSubject(k)}>
            {k}
          </button>
        ))}
      </div>
      <p className="mini">Tippe auf ein Thema, dann startet eine Übung. Mit dem Knopf rechts legst du das Thema in „Meine Auswahl“.</p>
      {SUBJECTS[subject].map((t) => {
        const on = selection.includes(t.name)
        const done = practiced.has(t.name)
        return (
          <div key={t.name} className="topic-row">
            <button className="card tap" onClick={() => onStart(t.name)}>
              <b>{t.name}</b>
              <span>
                <span className={`pill ${done ? 'ok' : 'idle'}`}>{done ? 'geübt' : 'neu'}</span>
              </span>
            </button>
            <button className="pick-btn" aria-pressed={on} aria-label={on ? `${t.name} aus Meine Auswahl nehmen` : `${t.name} in Meine Auswahl legen`} onClick={() => onToggle(t.name)}>
              {on ? '✓ Auswahl' : '+ Auswahl'}
            </button>
          </div>
        )
      })}
    </Screen>
  )
}

interface SelectionProps {
  selection: string[]
  onStart: (topic: string) => void
  onChange: (next: string[]) => void
  onBack: () => void
}

export function SelectionScreen({ selection, onStart, onChange, onBack }: SelectionProps) {
  const [removed, setRemoved] = useState<{ topic: string; index: number } | null>(null)

  const remove = (i: number) => {
    setRemoved({ topic: selection[i], index: i })
    onChange(selection.filter((_, j) => j !== i))
  }
  const undo = () => {
    if (!removed) return
    const next = [...selection]
    next.splice(removed.index, 0, removed.topic)
    onChange(next)
    setRemoved(null)
  }

  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Meine Auswahl</div>
      {selection.length === 0 ? (
        <p className="mini">Du hast noch nichts ausgewählt. Tippe bei einem Fach auf ein Thema.</p>
      ) : (
        <p className="mini">Tippe auf ein Thema, dann startet eine Übung. Mit den Pfeilen änderst du die Reihenfolge. Mit ✕ nimmst du ein Thema heraus.</p>
      )}
      <ol className="sel-list">
        {selection.map((t, i) => (
          <li key={t} className="card sel-row">
            <button className="sel-name" onClick={() => onStart(t)}>
              <span className="sel-num">{i + 1}.</span>
              <span>{t}</span>
            </button>
            <span className="sel-tools">
              <button className="icon-btn" aria-label={`${t} nach oben`} disabled={i === 0} onClick={() => onChange(move(selection, i, -1))}>
                ↑
              </button>
              <button className="icon-btn" aria-label={`${t} nach unten`} disabled={i === selection.length - 1} onClick={() => onChange(move(selection, i, 1))}>
                ↓
              </button>
              <button className="icon-btn" aria-label={`${t} herausnehmen`} onClick={() => remove(i)}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      {removed && (
        <div className="fb no row-between" role="status">
          <span>„{removed.topic}“ ist herausgenommen.</span>
          <button className="btn sec slim undo" onClick={undo}>
            Rückgängig
          </button>
        </div>
      )}
    </Screen>
  )
}

export function OpenScreen({ lessons, onStart, onBack }: { lessons: Lesson[]; onStart: (l: Lesson, text: string) => void; onBack: () => void }) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Offene Übungen</div>
      {lessons.length === 0 && (
        <p className="mini">Im Moment gibt es keine offenen Übungen. Wenn du eine Aufgabe fertig gemacht hast, stehen hier zwei neue Aufgaben dazu.</p>
      )}
      {lessons.length > 0 && <p className="mini">Tippe auf eine Übung, dann startet sie.</p>}
      {lessons.flatMap((l) =>
        l.practice.map((p, i) => (
          <button key={`${l.id}-${i}`} className="card tap" onClick={() => onStart(l, p.text)}>
            <b>
              {l.topic} · Übung {i + 1}
            </b>
            <span>
              <Inline text={p.text} />
            </span>
            <span className="mini">{p.note}</span>
          </button>
        )),
      )}
    </Screen>
  )
}

// Gescannte Seiten (tippen öffnet die Aufgabenliste, ohne dass die KI die Seite neu liest)
// und ältere Foto-Aufgaben aus der Zeit vor dem Seiten-Scan
export function PhotosScreen({ pages, attempts, onPage, onBack }: { pages: Page[]; attempts: Attempt[]; onPage: (p: Page) => void; onBack: () => void }) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Aus meinen Fotos</div>
      {pages.length === 0 && attempts.length === 0 && <p className="mini">Du hast noch keine Seite fotografiert.</p>}
      {pages.length > 0 && <p className="q">Meine Seiten</p>}
      {pages.map((p) => (
        <button key={p.id} className="card tap" onClick={() => onPage(p)}>
          <span className="row-between">
            <b>
              {p.subject} · {p.title}
            </b>
            <span className="pill idle">{p.tasks.length === 1 ? '1 Aufgabe' : `${p.tasks.length} Aufgaben`}</span>
          </span>
          <span className="mini">{new Date(p.at).toLocaleDateString('de-DE')} · Tippen zum Auswählen</span>
        </button>
      ))}
      {attempts.length > 0 && pages.length > 0 && <p className="q">Frühere Fotos</p>}
      {attempts
        .slice()
        .reverse()
        .map((a) => (
          <div key={a.id} className="card row-between">
            <span>
              <b>{a.subject}</b> · {a.topic}
              <br />
              <span className="mini">{new Date(a.startedAt).toLocaleDateString('de-DE')}</span>
            </span>
            <span className={`pill ${a.finishedAt ? 'ok' : 'mid'}`}>{a.finishedAt ? 'fertig' : 'angefangen'}</span>
          </div>
        ))}
    </Screen>
  )
}

// Alle Aufgaben, die die KI für Luisa erstellt hat. Bestandene stehen im Archiv und lassen sich wiederholen.
export function LessonsScreen({ entries, onStart, onBack }: { entries: LessonEntry[]; onStart: (l: Lesson, passed: boolean) => void; onBack: () => void }) {
  const open = entries.filter((e) => !e.passed)
  const passed = entries.filter((e) => e.passed)
  const card = (e: LessonEntry) => (
    <button key={e.lesson.id} className="card tap" onClick={() => onStart(e.lesson, e.passed)}>
      <span className="row-between">
        <b>
          {e.lesson.subject} · {e.lesson.topic}
        </b>
        <span className={`pill ${e.passed ? 'ok' : 'mid'}`}>{e.passed ? 'bestanden' : 'angefangen'}</span>
      </span>
      <span className="clamp">
        <Inline text={e.lesson.task} />
      </span>
      <span className="mini">
        {new Date(e.lastAt).toLocaleDateString('de-DE')} · {e.passed ? 'Tippen zum Wiederholen' : 'Tippen zum Weitermachen'}
      </span>
    </button>
  )
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Meine Aufgaben</div>
      {entries.length === 0 && <p className="mini">Hier stehen alle Aufgaben, die Henni für dich vorbereitet hat. Noch ist keine da.</p>}
      {open.length > 0 && (
        <>
          <p className="q">Noch nicht fertig</p>
          {open.map(card)}
        </>
      )}
      {passed.length > 0 && (
        <>
          <p className="q">Archiv: schon bestanden</p>
          <p className="mini">Du kannst jede Aufgabe noch einmal von vorn machen. Ein neues Ei gibt es dafür nicht, das hast du beim ersten Mal schon bekommen.</p>
          {passed.map(card)}
        </>
      )}
    </Screen>
  )
}
