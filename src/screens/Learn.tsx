import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pizza } from '../components/Art'
import { VisualView } from '../components/Visuals'
import { Frac, Inline, Rich } from '../components/Rich'
import { HenniSays, Ladder, Screen } from '../components/Ui'
import { GLOSSARY } from '../data/glossary'
import { checkAnswer, type CheckResult } from '../logic/check'
import { spoken } from '../logic/speech'
import type { Farm, Lesson, Page, Step, VersionKey } from '../types'
import { VERSION_LABEL } from '../types'
import { PageTasks, type TaskStatus } from './Page'

export function Camera({ onPhoto, onBack }: { onPhoto: (file: File) => void; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return (
    <Screen
      foot={
        <>
          {url ? (
            <button className="btn" onClick={() => file && onPhoto(file)}>
              Foto verwenden
            </button>
          ) : (
            <label className="btn" htmlFor="photo">
              Foto machen
            </label>
          )}
          <button className="btn sec" onClick={url ? () => setUrl(null) : onBack}>
            {url ? 'Neues Foto' : 'Zurück'}
          </button>
        </>
      }
    >
      <div className="s-title">Seite fotografieren</div>
      <p className="mini">Halte das Handy über die Seite. Alle Aufgaben sollen gut zu lesen sein. Danach wählst du, welche du machen willst.</p>
      <input
        id="photo"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            setUrl(URL.createObjectURL(f))
          }
          e.target.value = ''
        }}
      />
      {url ? <img className="photo-prev" src={url} alt="Dein Foto" /> : <div className="viewfinder">Hier erscheint dein Foto.</div>}
      <p className="mini">Danach liest Henni die Aufgabe. Das dauert ungefähr eine Minute.</p>
    </Screen>
  )
}

// Wartebildschirm, solange die KI den Lernpfad erstellt. Die Sekunden zeigen, dass etwas passiert.
export function Waiting({ text, onCancel }: { text: string; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onCancel}>
          Abbrechen
        </button>
      }
    >
      <HenniSays big>
        <div className="s-title small">{text}</div>
        <div>Ich bereite die Schritte für dich vor. Das dauert meistens ein bis zwei Minuten.</div>
      </HenniSays>
      <div className="wait" role="status">
        <div className="wait-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(95, (seconds / 90) * 100)}%` }} />
        </div>
        <span className="mini">Schon {seconds} Sekunden.</span>
      </div>
    </Screen>
  )
}

export function Problem({ text, detail, retry, onRetry, onBack }: { text: string; detail?: string; retry: string; onRetry: () => void; onBack: () => void }) {
  return (
    <Screen
      foot={
        <>
          <button className="btn" onClick={onRetry}>
            {retry}
          </button>
          <button className="btn sec" onClick={onBack}>
            Zurück
          </button>
        </>
      }
    >
      <HenniSays big>
        <div className="s-title small">Das hat nicht geklappt.</div>
        <div>{text}</div>
      </HenniSays>
      {detail && <p className="mini">Für Eltern: {detail}</p>}
    </Screen>
  )
}

// Beim Zurückgehen stehen Luisas frühere Eingaben wieder in den Feldern
function earlierInput(c: Step['check'], r: CheckResult | null): string[] {
  if (!r) return []
  if (c.type === 'fraction') return r.given.split('/')
  if (c.type === 'numerators') return r.given.split(' und ').map((g) => g.split('/')[0])
  return [r.given]
}

function CheckBox({ step, result, onResult }: { step: Step; result: CheckResult | null; onResult: (r: CheckResult) => void }) {
  const c = step.check
  const [vals, setVals] = useState<string[]>(() => earlierInput(c, result))
  const set = (i: number, v: string) => setVals((old) => Object.assign([...old], { [i]: v }))
  const submit = (input = vals) => {
    const r = checkAnswer(c, input)
    if (r) onResult(r)
  }
  const num = (i: number, label: string) => (
    <input className="num" type="number" inputMode="numeric" aria-label={label} value={vals[i] ?? ''} onChange={(e) => set(i, e.target.value)} />
  )
  return (
    <section className="card ask">
      <span className="q">{c.question}</span>
      {c.type === 'choice' && (
        <div className="chips">
          {c.options.map((o) => (
            <button key={o} type="button" className={`chip${result?.given === o ? ' on' : ''}`} onClick={() => submit([o])}>
              {o}
            </button>
          ))}
        </div>
      )}
      {c.type === 'number' && <div>{num(0, 'Zahl')}</div>}
      {c.type === 'value' && (
        <form
          className="eq"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            className="text-in"
            aria-label="Deine Antwort"
            inputMode={c.answers.every((a) => /^-?[\d\s.,]+$/.test(a)) ? 'decimal' : 'text'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={vals[0] ?? ''}
            onChange={(e) => set(0, e.target.value)}
          />
        </form>
      )}
      {c.type === 'numerators' && (
        <div className="eq">
          {c.fractions.map(([z, n], i) => (
            <span key={i} className="eq-part">
              <Frac n={z} d={n} /> = <Frac n={num(i, `Zähler ${i + 1}`)} d={c.denominator} />
            </span>
          ))}
        </div>
      )}
      {c.type === 'fraction' && (
        <div className="eq">
          <Inline text={c.left} /> <Frac n={num(0, 'Zähler')} d={num(1, 'Nenner')} />
        </div>
      )}
      {c.type !== 'choice' && (
        <button type="button" className="btn sec slim" onClick={() => submit()}>
          Prüfen
        </button>
      )}
      {result && (
        <div className={`fb ${result.status === 'ok' ? 'ok' : 'no'}`} role="status">
          {result.text}
        </div>
      )}
    </section>
  )
}

interface StepProps {
  lesson: Lesson
  index: number
  version: number
  results: (CheckResult | null)[]
  onGoTo: (index: number) => void
  onAgain: () => void
  onResult: (r: CheckResult) => void
  onNext: () => void
  onStop: () => void
  // Hilfe „Vorlesen“: Henni liest die Erklärung vor
  readAloud?: boolean
  // Hilfe „Zahlen mit Bild“: Mengenbild immer zeigen (sonst nur bei der Fassung „Mit einem Bild“)
  showVisual?: boolean
  // „Ich verstehe es noch nicht“
  onStuck: () => void
  // nach dem ersten „Ich verstehe es noch nicht“: Leichte Sprache, Bild und Tipp
  helpOn?: boolean
}

// Hilfe nach „Ich verstehe es noch nicht“: einmal ins Bild holen, damit das Kind sie sieht
function HelpPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  // In Klammern: neuere Browser geben hier ein Promise zurück, das React sonst als Aufräum-Funktion aufrufen würde
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])
  return (
    <section ref={ref} className="fb ok stack" aria-label="Henni hilft dir">
      {children}
    </section>
  )
}

// Erster Tipp zur Prüffrage, ohne das Ergebnis zu verraten
function firstHint(check: Step['check']): string | null {
  if ('hint' in check) return check.hint
  if (check.type === 'numerators') return check.hints[0] ?? null
  if (check.type === 'fraction') return check.hints[0]?.text ?? null
  return null
}

function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => () => window.speechSynthesis?.cancel(), [text])
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const toggle = () => {
    window.speechSynthesis.cancel()
    if (on) return setOn(false)
    const u = new SpeechSynthesisUtterance(spoken(text))
    u.lang = 'de-DE'
    u.rate = 0.9
    u.onend = () => setOn(false)
    u.onerror = () => setOn(false)
    setOn(true)
    window.speechSynthesis.speak(u)
  }
  return (
    <button type="button" className="btn sec slim read-aloud" onClick={toggle} aria-pressed={on}>
      {on ? 'Vorlesen anhalten' : 'Vorlesen'}
    </button>
  )
}

// Was das Kind in den Schritten davor herausgefunden hat. Ein Tipp führt zurück zu diesem Schritt.
function Earlier({ lesson, index, results, onGoTo }: { lesson: Lesson; index: number; results: (CheckResult | null)[]; onGoTo: (i: number) => void }) {
  if (index === 0) return null
  return (
    <section className="earlier" aria-label="Das hast du schon herausgefunden">
      <b>Das hast du schon herausgefunden:</b>
      <ol>
        {lesson.steps.slice(0, index).map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => onGoTo(i)}>
              <span className="mini">Schritt {i + 1}: {s.title}</span>
              <span>
                <Inline text={s.check.question} />
                <br />
                <b>Deine Antwort: {results[i]?.given ?? '–'}</b>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <span className="mini">Tippe auf einen Schritt, um ihn dir noch einmal anzusehen.</span>
    </section>
  )
}

export function StepScreen({ lesson, index, version, results, onGoTo, onAgain, onResult, onNext, onStop, readAloud, showVisual, onStuck, helpOn }: StepProps) {
  const result = results[index] ?? null
  const step = lesson.steps[index]
  const v = step.versions[version]
  const [term, setTerm] = useState<string | null>(null)
  const last = index === lesson.steps.length - 1
  const ok = result?.status === 'ok'
  const glossary = { ...GLOSSARY, ...lesson.glossary }
  return (
    <Screen
      top={`${lesson.id}-${index}-${version}`}
      foot={
        <>
          <div className="row2">
            <button className="btn calm" onClick={onAgain}>
              Erklär es mir nochmal
            </button>
            <button className="btn calm" onClick={onStuck} disabled={ok}>
              Ich verstehe es noch nicht
            </button>
          </div>
          <button className="btn" onClick={onNext} disabled={!ok}>
            {last ? 'Fertig' : `Weiter zu Schritt ${index + 2}`}
          </button>
          {index > 0 && (
            <button className="btn sec" onClick={() => onGoTo(index - 1)}>
              Zurück zu Schritt {index}
            </button>
          )}
          <button className="link" onClick={onStop}>
            Aufhören und zur Startseite
          </button>
        </>
      }
    >
      <div className="progress" aria-hidden="true">
        {lesson.steps.map((_, i) => (
          <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
        ))}
      </div>
      <div className="plabel">
        Schritt {index + 1} von {lesson.steps.length}
      </div>
      <details className="task-card" open={index === 0}>
        <summary>Die Aufgabe</summary>
        <Rich text={lesson.task} />
      </details>
      <Earlier lesson={lesson} index={index} results={results} onGoTo={onGoTo} />
      <div className="s-title">{step.title}</div>
      <HenniSays>
        <span className="vlabel">
          Erklärung {version + 1} von {step.versions.length} · {VERSION_LABEL[v.key as VersionKey]}
        </span>
        {v.graphic?.kind === 'pizza' && (
          <div className="pizza">
            {v.graphic.parts.map((p, i) => (
              <figure key={i}>
                <Pizza slices={p.slices} filled={p.filled} />
                <figcaption>{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {step.visual && (showVisual || helpOn || v.key === 'bild') && <VisualView v={step.visual} />}
        <div className="explain">
          <Rich text={v.text} onTerm={(t) => setTerm(term === t ? null : t)} />
        </div>
        {readAloud && <ReadAloud key={`${index}-${version}`} text={`${step.title}. ${v.text}`} />}
      </HenniSays>
      {helpOn && (
        <HelpPanel key={index}>
          {step.easy && v.key !== 'leicht' && (
            <span>
              <b>Ganz einfach gesagt:</b> <Inline text={step.easy} />
            </span>
          )}
          {firstHint(step.check) && (
            <span>
              <b>Tipp:</b> <Inline text={firstHint(step.check)!} />
            </span>
          )}
          <span className="mini">Wenn du es dann immer noch nicht verstehst, drücke noch einmal „Ich verstehe es noch nicht“.</span>
        </HelpPanel>
      )}
      {term && glossary[term] && (
        <div className="gloss">
          <b>{term}:</b> {glossary[term]}
        </div>
      )}
      <div className="why">
        <b>Warum machen wir das?</b>
        {step.why}
      </div>
      <CheckBox key={index} step={step} result={result} onResult={onResult} />
    </Screen>
  )
}

// Nach dem zweiten „Ich verstehe es noch nicht“: drei klare Wege, nichts Verschachteltes
export function Stuck({ onEasier, onLookAgain, onPause }: { onEasier: () => void; onLookAgain: () => void; onPause: () => void }) {
  return (
    <Screen>
      <div className="s-title">Das ist nicht schlimm.</div>
      <HenniSays>Manche Aufgaben sind am Anfang schwer. Du kannst jetzt eins von drei Dingen machen.</HenniSays>
      <button className="card tap" onClick={onEasier}>
        <b>1. Eine leichtere Aufgabe</b>
        <span className="mini">Henni gibt dir eine leichtere Aufgabe zum selben Thema. Sie hat kleinere Schritte.</span>
      </button>
      <button className="card tap" onClick={onLookAgain}>
        <b>2. Den Schritt noch einmal ansehen</b>
        <span className="mini">Du gehst zurück zu dem Schritt von eben.</span>
      </button>
      <button className="card tap" onClick={onPause}>
        <b>3. Pause machen</b>
        <span className="mini">Du gehst zur Startseite. Frag einen Erwachsenen, ob er dir hilft. Deine Eltern sehen, wo du warst.</span>
      </button>
    </Screen>
  )
}

interface DoneProps {
  lesson: Lesson
  farm: Farm
  egg: boolean
  rewardMessages: string[]
  // Stammt die Aufgabe von einer gescannten Seite, bietet Henni die übrigen Aufgaben davon an
  next?: { page: Page; status: TaskStatus[]; only: number[]; onPick: (i: number) => void }
  onFarm: () => void
  onHome: () => void
}

export function Done({ lesson, farm, egg, rewardMessages, next, onFarm, onHome }: DoneProps) {
  return (
    <Screen
      foot={
        <button className="btn" onClick={onHome}>
          Zur Startseite
        </button>
      }
    >
      <div className="s-title">Du hast die Aufgabe fertig.</div>
      <p>Du hast alle {lesson.steps.length} Schritte gemacht. Schreibe dein Ergebnis jetzt in dein Heft.</p>
      <section className="card stack">
        <b>{egg ? 'Du bekommst 1 Ei für deinen Bauernhof.' : 'Diese Aufgabe hast du schon einmal bestanden. Das Ei dafür hast du schon bekommen.'}</b>
        {rewardMessages.map((m) => (
          <span key={m}>{m}</span>
        ))}
        <Ladder farm={farm} />
        <button className="btn sec slim" onClick={onFarm}>
          Bauernhof ansehen
        </button>
      </section>
      {next && next.only.length > 0 && (
        <>
          <p className="q">Welche Aufgabe von „{next.page.title}“ willst du als Nächstes machen?</p>
          <PageTasks page={next.page} status={next.status} only={next.only} onPick={next.onPick} />
          <p className="mini">Du kannst auch eine Pause machen. Die Seite bleibt bei „Aus meinen Fotos“ gespeichert.</p>
        </>
      )}
      {next && next.only.length === 0 && <p className="q">Du hast alle Aufgaben von „{next.page.title}“ geschafft.</p>}
      <p className="q">Zwei neue Übungsaufgaben zum selben Thema:</p>
      {lesson.practice.map((p, i) => (
        <div key={i} className="card">
          <b>Übung {i + 1}:</b> <Inline text={p.text} />
          <br />
          <span className="mini">{p.note}</span>
        </div>
      ))}
      <p className="mini">Du findest sie unter „Meine Übungen“ bei „Offene Übungen“.</p>
    </Screen>
  )
}
