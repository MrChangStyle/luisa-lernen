import { useMemo, useState, type ReactNode } from 'react'
import { Face } from '../components/Art'
import { Inline } from '../components/Rich'
import { Ladder, Screen } from '../components/Ui'
import { MoodLine, TaskBars } from '../components/Charts'
import { parsePeriod, periodKey, periodLabel, periodOptions, summarize } from '../logic/stats'
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
      <details key={a.id} className="fold">
        <summary>
          <span>
            {a.subject} · {a.topic}
          </span>
          <span className={`pill ${a.finishedAt ? 'ok' : 'mid'}`}>{a.finishedAt ? 'fertig' : 'angefangen'}</span>
        </summary>
        <section className="card stack">
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
      </details>
    )
  }
  const today = dayKey(new Date())
  const todayMood = saved.mood[today]
  const options = useMemo(() => periodOptions(saved), [saved])
  const [periodSel, setPeriodSel] = useState(periodKey(options[0]))
  const period = parsePeriod(periodSel)
  const sum = summarize(saved, period)
  const avg = period.kind !== 'week'
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
      <section className="card mood-row">
        {todayMood ? <Face value={todayMood.value} size={56} /> : <span className="mini">–</span>}
        <div>
          <b>Stimmung heute:</b> {todayMood ? `${moodText(todayMood.value)} (${clock(todayMood.at)})` : 'noch nicht eingetragen'}
        </div>
      </section>
      <section className="card dash">
        <b>Übersicht</b>
        <select aria-label="Zeitraum" value={periodSel} onChange={(e) => setPeriodSel(e.target.value)}>
          <optgroup label="Wochen">
            {options.filter((o) => o.kind === 'week').map((o) => (
              <option key={periodKey(o)} value={periodKey(o)}>
                {periodLabel(o)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Monate">
            {options.filter((o) => o.kind === 'month').map((o) => (
              <option key={periodKey(o)} value={periodKey(o)}>
                {periodLabel(o)}
              </option>
            ))}
          </optgroup>
          <option value="all">Gesamte Zeit</option>
        </select>
        <div className="tiles">
          <div className="tile">
            <b>{sum.tasks}</b>
            <span>Aufgaben fertig</span>
          </div>
          <div className="tile">
            <b>{sum.minutes >= 60 ? `${Math.floor(sum.minutes / 60)} h ${sum.minutes % 60}` : sum.minutes} min</b>
            <span>Lernzeit</span>
          </div>
          <div className="tile">
            <b>{sum.mood === null ? '–' : moodText(sum.mood).replace('Mir geht es ', '').replace('.', '')}</b>
            <span>Ø Stimmung ({sum.moodDays} {sum.moodDays === 1 ? 'Tag' : 'Tage'})</span>
          </div>
        </div>
        <TaskBars key={`t${periodSel}`} days={sum.days} avg={avg} />
        <MoodLine key={`m${periodSel}`} days={sum.days} avg={avg} />
        <span className="mini">Lernzeit zählt die Zeit vom Start bis zum Fertigmachen einer Aufgabe, höchstens 60 Minuten je Aufgabe.</span>
      </section>
      <section className="card stack">
        <b>Luisas Bauernhof</b>
        <Ladder farm={saved.farm} />
      </section>
      <details className="fold">
        <summary>
          <span>Aufgaben</span>
          <span className="pill idle">{current.length}</span>
        </summary>
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
        <details className="fold">
          <summary>
            <span>Archiv</span>
            <span className="pill idle">{archived.length}</span>
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
      </details>
      <details className="fold">
        <summary>
          <span>Verlauf</span>
          <span className="pill idle">{saved.events.length}</span>
        </summary>
        <ul className="log">
          {saved.events
            .slice(-60)
            .reverse()
            .map((e, i) => (
              <li key={i}>
                <span>
                  {dateLabel(e.at)}
                  <br />
                  {clock(e.at)}
                </span>
                <span>{e.text}</span>
              </li>
            ))}
        </ul>
      </details>
    </Screen>
  )
}
