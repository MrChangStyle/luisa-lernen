import { useEffect, useState } from 'react'
import { Pizza } from '../components/Art'
import { Frac, Inline, Rich } from '../components/Rich'
import { HenniSays, Ladder, Screen } from '../components/Ui'
import { GLOSSARY } from '../data/glossary'
import { checkAnswer, type CheckResult } from '../logic/check'
import type { Farm, Lesson, Step, VersionKey } from '../types'
import { VERSION_LABEL } from '../types'

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
      <div className="s-title">Aufgabe fotografieren</div>
      <p className="mini">Halte das Handy über die Aufgabe. Es soll nur eine Aufgabe im Bild sein.</p>
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

export function Problem({ text, retry, onRetry, onBack }: { text: string; retry: string; onRetry: () => void; onBack: () => void }) {
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
    </Screen>
  )
}

export function Confirm({ lesson, onYes, onNo }: { lesson: Lesson; onYes: () => void; onNo: () => void }) {
  return (
    <Screen
      foot={
        <>
          <p className="q">Ist das die richtige Aufgabe?</p>
          <div className="row2">
            <button className="btn" onClick={onYes}>
              Ja, starten
            </button>
            <button className="btn sec" onClick={onNo}>
              Nein, neues Foto
            </button>
          </div>
        </>
      }
    >
      <div className="s-title">Ich habe diese Aufgabe gelesen:</div>
      <div className="card">
        <b>{lesson.source}:</b> <Inline text={lesson.task} />
      </div>
      <p>
        <b>Fach:</b> {lesson.subject}
        <br />
        <b>Thema:</b> {lesson.topic}
      </p>
      <p>
        Wir gehen die Aufgabe in <b>{lesson.steps.length} Schritten</b> durch. Das Ergebnis rechnest du selbst aus. Ich zeige dir, wie es geht.
      </p>
    </Screen>
  )
}

function CheckBox({ step, result, onResult }: { step: Step; result: CheckResult | null; onResult: (r: CheckResult) => void }) {
  const c = step.check
  const [vals, setVals] = useState<string[]>([])
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
  result: CheckResult | null
  onAgain: () => void
  onResult: (r: CheckResult) => void
  onNext: () => void
  onStop: () => void
}

export function StepScreen({ lesson, index, version, result, onAgain, onResult, onNext, onStop }: StepProps) {
  const step = lesson.steps[index]
  const v = step.versions[version]
  const [term, setTerm] = useState<string | null>(null)
  const last = index === lesson.steps.length - 1
  const ok = result?.status === 'ok'
  const glossary = { ...GLOSSARY, ...lesson.glossary }
  return (
    <Screen
      foot={
        <>
          <button className="btn calm" onClick={onAgain}>
            Erklär es mir nochmal
          </button>
          <button className="btn" onClick={onNext} disabled={!ok}>
            {last ? 'Fertig' : `Weiter zu Schritt ${index + 2}`}
          </button>
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
        <div className="explain">
          <Rich text={v.text} onTerm={(t) => setTerm(term === t ? null : t)} />
        </div>
      </HenniSays>
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

export function Done({ lesson, farm, rewardMessages, onFarm, onHome }: { lesson: Lesson; farm: Farm; rewardMessages: string[]; onFarm: () => void; onHome: () => void }) {
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
        <b>Du bekommst 1 Ei für deinen Bauernhof.</b>
        {rewardMessages.map((m) => (
          <span key={m}>{m}</span>
        ))}
        <Ladder farm={farm} />
        <button className="btn sec slim" onClick={onFarm}>
          Bauernhof ansehen
        </button>
      </section>
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
