import { useState, type ReactNode } from 'react'
import { Face } from '../components/Art'
import { Inline } from '../components/Rich'
import { Ladder, Screen } from '../components/Ui'
import { dayKey, moodText } from '../logic/mood'
import { clock, dateLabel, type CloudState, type Saved } from '../state'
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
  cloud: CloudState
  lessons: Record<string, Lesson>
  onArchive: (ids: string[]) => void
  onRestore: (id: string) => void
  onBack: () => void
}

export function Family({ saved, cloud, lessons, onArchive, onRestore, onBack }: FamilyProps) {
  // Welche Aufgabe gerade auf „Wirklich zurücksetzen?“ wartet: eine Id oder „alle“
  const [asking, setAsking] = useState<string | null>(null)
  const current = saved.attempts.filter((a) => !a.archivedAt)
  const archived = saved.attempts.filter((a) => a.archivedAt)
  const ask = (what: string, question: string, ids: string[]) =>
    asking === what ? (
      <div className="fb no stack" role="alertdialog" aria-label={question}>
        <span>{question} Sie kommt ins Archiv, nichts wird gelöscht. Luisas Bauernhof bleibt, wie er ist.</span>
        <div className="row2">
          <button
            className="btn slim"
            onClick={() => {
              onArchive(ids)
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
  const card = (a: Saved['attempts'][number], action: ReactNode) => {
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
          {a.archivedAt && ` · archiviert am ${dateLabel(a.archivedAt)}`}
        </div>
        {lesson && (
          <div className="mini">
            <Inline text={lesson.task} />
          </div>
        )}
        <ul className="log">
          {a.stats.map((st, i) => (
            <li key={i}>
              <span>Schritt {i + 1}</span>
              <span>
                {lesson?.steps[i]?.title}
                <br />
                <span className="mini">
                  {st.again}× nochmal erklärt
                  {st.helped && ` · geholfen hat: ${VERSION_LABEL[st.helped]}`}
                  {st.wrong.length > 0 && ` · Eingaben, die nicht passten: ${st.wrong.map((w) => `„${w}“`).join(', ')}`}
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
        {action}
      </section>
    )
  }
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
      <p className={`mini cloud ${cloud}`} role="status">
        {
          {
            laden: 'Cloud: Abgleich läuft …',
            ok: '✓ Cloud: Alles ist gespeichert und auf jedem angemeldeten Gerät gleich.',
            aus: 'Cloud: noch nicht eingerichtet. Im Moment ist alles nur auf diesem Gerät gespeichert.',
            fehler: 'Cloud: gerade keine Verbindung. Die Änderungen werden nachgeholt.',
          }[cloud]
        }
      </p>
      <p className={`mini cloud ${cloud}`} role="status">
        {
          {
            laden: 'Cloud: Abgleich läuft …',
            ok: '✓ Cloud: Alles ist gespeichert und auf jedem angemeldeten Gerät gleich.',
            aus: 'Cloud: noch nicht eingerichtet. Im Moment ist alles nur auf diesem Gerät gespeichert.',
            fehler: 'Cloud: gerade keine Verbindung. Die Änderungen werden nachgeholt.',
          }[cloud]
        }
      </p>
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
      {current.length === 0 && <p className="mini">Keine aktuellen Aufgaben.</p>}
      {current.length > 1 &&
        ask(
          'alle',
          `Wirklich alle ${current.length} Aufgaben zurücksetzen?`,
          current.map((a) => a.id),
        )}
      {current
        .slice()
        .reverse()
        .map((a) => card(a, ask(a.id, `„${a.topic}“ wirklich zurücksetzen?`, [a.id])))}
      <details className="archive">
        <summary>
          Archiv ({archived.length} {archived.length === 1 ? 'Aufgabe' : 'Aufgaben'})
        </summary>
        {archived.length === 0 && <p className="mini">Zurückgesetzte Aufgaben landen hier. Sie werden nie gelöscht.</p>}
        {archived
          .slice()
          .sort((x, y) => (y.archivedAt ?? '').localeCompare(x.archivedAt ?? ''))
          .map((a) =>
            card(
              a,
              <button className="btn sec slim" onClick={() => onRestore(a.id)}>
                Zurückholen
              </button>,
            ),
          )}
      </details>
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
