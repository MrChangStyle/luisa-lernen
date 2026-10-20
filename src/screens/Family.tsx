import { useState } from 'react'
import { Face } from '../components/Art'
import { Inline } from '../components/Rich'
import { Ladder, Screen } from '../components/Ui'
import { dayKey, moodText } from '../logic/mood'
import { clock, dateLabel, type Saved } from '../state'
import type { Lesson } from '../types'
import { VERSION_LABEL } from '../types'

// In der Testversion schützt eine PIN auf dem Gerät den Bereich vor versehentlichem Öffnen.
// Echte Eltern-Zugänge für Mama und Papa kommen mit der Datenbank.
export function PinGate({ pin, onSetPin, onOk, onBack }: { pin: string | null; onSetPin: (p: string) => void; onOk: () => void; onBack: () => void }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const submit = () => {
    if (!/^\d{4}$/.test(val)) return setErr('Bitte genau 4 Ziffern eingeben.')
    if (!pin) {
      onSetPin(val)
      onOk()
    } else if (val === pin) onOk()
    else setErr('Die PIN stimmt nicht.')
  }
  return (
    <Screen
      foot={
        <>
          <button className="btn" onClick={submit}>
            {pin ? 'Öffnen' : 'PIN festlegen und öffnen'}
          </button>
          <button className="btn sec" onClick={onBack}>
            Zurück
          </button>
        </>
      }
    >
      <div className="s-title">Familienbereich</div>
      <p>{pin ? 'Bitte die Eltern-PIN eingeben.' : 'Lege eine 4-stellige Eltern-PIN fest. Luisa braucht sie nicht.'}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input id="pin" className="num wide" type="password" inputMode="numeric" maxLength={4} autoComplete="off" aria-label="PIN" value={val} onChange={(e) => setVal(e.target.value)} />
      </form>
      {err && <div className="fb no">{err}</div>}
    </Screen>
  )
}

interface FamilyProps {
  saved: Saved
  lessons: Record<string, Lesson>
  onReset: (ids: string[]) => void
  onBack: () => void
}

export function Family({ saved, lessons, onReset, onBack }: FamilyProps) {
  // Welche Aufgabe gerade auf „Wirklich zurücksetzen?“ wartet: eine Id oder „alle“
  const [asking, setAsking] = useState<string | null>(null)
  const ask = (what: string, question: string, ids: string[]) =>
    asking === what ? (
      <div className="fb no stack" role="alertdialog" aria-label={question}>
        <span>{question} Luisas Bauernhof bleibt, wie er ist.</span>
        <div className="row2">
          <button
            className="btn slim"
            onClick={() => {
              onReset(ids)
              setAsking(null)
            }}
          >
            Ja, zurücksetzen
          </button>
          <button className="btn sec slim" onClick={() => setAsking(null)}>
            Abbrechen
          </button>
        </div>
      </div>
    ) : (
      <button className="btn sec slim" onClick={() => setAsking(what)}>
        {what === 'alle' ? 'Alle Aufgaben zurücksetzen' : 'Diese Aufgabe zurücksetzen'}
      </button>
    )
  const today = dayKey(new Date())
  const todayMood = saved.mood[today]
  const week = Object.entries(saved.mood).sort().slice(-7)
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück zu Luisas Ansicht
        </button>
      }
    >
      <div className="s-title">Familienbereich</div>
      <section className="card mood-row">
        {todayMood ? <Face value={todayMood.value} size={56} /> : <span className="mini">–</span>}
        <div>
          <b>Stimmung heute:</b> {todayMood ? `${moodText(todayMood.value)} (${clock(todayMood.at)})` : 'noch nicht eingetragen'}
          {week.length > 0 && (
            <div className="mini">
              Letzte Tage: {week.map(([d, m]) => `${dateLabel(d)} ${moodText(m.value).replace('Mir geht es ', '').replace('.', '')}`).join(' · ')}
            </div>
          )}
        </div>
      </section>
      <section className="card stack">
        <b>Luisas Bauernhof</b>
        <Ladder farm={saved.farm} />
      </section>
      <div className="s-title small">Aufgaben</div>
      {saved.attempts.length === 0 && <p className="mini">Noch keine Aufgaben.</p>}
      {saved.attempts.length > 1 &&
        ask(
          'alle',
          `Wirklich alle ${saved.attempts.length} Aufgaben zurücksetzen?`,
          saved.attempts.map((a) => a.id),
        )}
      {saved.attempts
        .slice()
        .reverse()
        .map((a) => {
          const lesson = lessons[a.lessonId]
          return (
            <section key={a.id} className="card stack">
              <div className="row-between">
                <b>
                  {a.subject} · {a.topic}
                </b>
                <span className={`pill ${a.finishedAt ? 'ok' : 'mid'}`}>{a.finishedAt ? 'fertig' : 'angefangen'}</span>
              </div>
              <div className="mini">
                {a.source} · {dateLabel(a.startedAt)} {clock(a.startedAt)}
              </div>
              {lesson && (
                <div className="mini">
                  <Inline text={lesson.task} />
                </div>
              )}
              <ul className="log">
                {a.stats.map((s, i) => (
                  <li key={i}>
                    <span>Schritt {i + 1}</span>
                    <span>
                      {lesson?.steps[i]?.title}
                      <br />
                      <span className="mini">
                        {s.again}× nochmal erklärt
                        {s.helped && ` · geholfen hat: ${VERSION_LABEL[s.helped]}`}
                        {s.wrong.length > 0 && ` · Eingaben, die nicht passten: ${s.wrong.map((w) => `„${w}“`).join(", ")}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {lesson && (
                <div className="gloss">
                  <b>Lösung (nur für Eltern):</b> {lesson.parentSolution}
                </div>
              )}
              {ask(a.id, `„${a.topic}“ wirklich zurücksetzen?`, [a.id])}
            </section>
          )
        })}
      <div className="s-title small">Verlauf</div>
      <ul className="log">
        {saved.events
          .slice(-40)
          .reverse()
          .map((e, i) => (
            <li key={i}>
              <span>{clock(e.at)}</span>
              <span>{e.text}</span>
            </li>
          ))}
      </ul>
    </Screen>
  )
}
