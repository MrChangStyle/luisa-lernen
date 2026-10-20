import { useState } from 'react'
import { Inline } from '../components/Rich'
import { move } from '../logic/selection'
import { Screen } from '../components/Ui'
import { SUBJECTS } from '../data/subjects'
import type { Lesson } from '../types'
import type { Attempt } from '../state'

const LESSON_TOPICS = new Set(['Brüche addieren'])

interface MenuProps {
  selection: string[]
  openCount: number
  photoCount: number
  onSubject: (s: string) => void
  go: (s: 'selection' | 'open' | 'photos' | 'home') => void
}

export function PracticeMenu({ selection, openCount, photoCount, onSubject, go }: MenuProps) {
  const item = (to: 'selection' | 'open' | 'photos', title: string, sub: string, n: number) => (
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
      {item('open', 'Offene Übungen', 'Die zwei neuen Aufgaben zu deinen Fotos', openCount)}
      {item('photos', 'Aus meinen Fotos', 'Alle Themen, die du schon fotografiert hast', photoCount)}
    </Screen>
  )
}

export function SubjectScreen({ subject, selection, onToggle, onSubject, onBack }: { subject: string; selection: string[]; onToggle: (t: string) => void; onSubject: (s: string) => void; onBack: () => void }) {
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
      <p className="mini">Tippe auf ein Thema, um es in „Meine Auswahl“ zu legen.</p>
      {SUBJECTS[subject].map((t) => {
        const on = selection.includes(t.name)
        return (
          <button key={t.name} className={`card tap row-between${on ? ' picked' : ''}`} aria-pressed={on} onClick={() => onToggle(t.name)}>
            <span>
              {on ? '✓ ' : ''}
              {t.name}
            </span>
            <span className={`pill ${t.status === 'geübt' ? 'ok' : 'idle'}`}>{t.status}</span>
          </button>
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
  const [chosen, setChosen] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ topic: string; index: number } | null>(null)
  const current = chosen && selection.includes(chosen) ? chosen : (selection[0] ?? null)
  const ready = current !== null && LESSON_TOPICS.has(current)

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
        <>
          {current && (
            <button className="btn" disabled={!ready} onClick={() => current && onStart(current)}>
              {ready ? `Mit „${current}“ anfangen` : `„${current}“ kommt mit der KI`}
            </button>
          )}
          <button className="btn sec" onClick={onBack}>
            Zurück
          </button>
        </>
      }
    >
      <div className="s-title">Meine Auswahl</div>
      {selection.length === 0 ? (
        <p className="mini">Du hast noch nichts ausgewählt. Tippe bei einem Fach auf ein Thema.</p>
      ) : (
        <p className="mini">Tippe auf ein Thema, um damit anzufangen. Mit den Pfeilen änderst du die Reihenfolge. Mit ✕ nimmst du ein Thema heraus.</p>
      )}
      <ol className="sel-list">
        {selection.map((t, i) => (
          <li key={t} className={`card sel-row${t === current ? ' picked' : ''}`}>
            <button className="sel-name" aria-pressed={t === current} onClick={() => setChosen(t)}>
              <span className="sel-num">{i + 1}.</span>
              <span>
                {t}
                <br />
                <span className={`pill ${LESSON_TOPICS.has(t) ? 'ok' : 'idle'}`}>{LESSON_TOPICS.has(t) ? 'bereit' : 'kommt mit der KI'}</span>
              </span>
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
      <p className="mini">In der Testversion gibt es eine fertige Übung: „Brüche addieren“. Die anderen Themen erstellt später die KI.</p>
    </Screen>
  )
}

export function OpenScreen({ lessons, onBack }: { lessons: Lesson[]; onBack: () => void }) {
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
        <p className="mini">Im Moment gibt es keine offenen Übungen. Wenn du eine Aufgabe fotografiert und fertig gemacht hast, stehen hier zwei neue Aufgaben dazu.</p>
      )}
      {lessons.flatMap((l) =>
        l.practice.map((p, i) => (
          <div key={`${l.id}-${i}`} className="card">
            <b>
              {l.topic} · Übung {i + 1}:
            </b>{' '}
            <Inline text={p.text} />
            <br />
            <span className="mini">{p.note}</span>
          </div>
        )),
      )}
    </Screen>
  )
}

export function PhotosScreen({ attempts, onBack }: { attempts: Attempt[]; onBack: () => void }) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Aus meinen Fotos</div>
      {attempts.length === 0 && <p className="mini">Du hast noch keine Aufgabe fotografiert.</p>}
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
