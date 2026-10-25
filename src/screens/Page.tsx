import { Inline } from '../components/Rich'
import { Screen } from '../components/Ui'
import type { Page } from '../types'

export type TaskStatus = 'bestanden' | 'angefangen' | 'neu'
const PILL: Record<TaskStatus, string> = { bestanden: 'ok', angefangen: 'mid', neu: 'idle' }

// Die Aufgaben einer Seite zum Antippen. Auch auf dem Fertig-Bildschirm für „Nächste Aufgabe“.
export function PageTasks({ page, status, only, onPick }: { page: Page; status: TaskStatus[]; only?: number[]; onPick: (i: number) => void }) {
  return (
    <>
      {page.tasks.map((t, i) =>
        only && !only.includes(i) ? null : (
          <button key={i} className="card tap" onClick={() => onPick(i)}>
            <span className="row-between">
              <b>
                {t.label} · {t.topic}
              </b>
              <span className={`pill ${PILL[status[i]]}`}>{status[i]}</span>
            </span>
            <span className="clamp">
              <Inline text={t.text} />
            </span>
          </button>
        ),
      )}
    </>
  )
}

// Nach dem Scannen: Luisa wählt, welche Aufgabe von der Seite sie machen will
export function PageScreen({ page, status, onPick, onBack }: { page: Page; status: TaskStatus[]; onPick: (i: number) => void; onBack: () => void }) {
  const n = page.tasks.length
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">{page.title}</div>
      <p>
        Ich habe auf deiner Seite {n === 1 ? 'eine Aufgabe' : `${n} Aufgaben`} gefunden ({page.subject}).
      </p>
      <p className="q">Welche Aufgabe willst du machen?</p>
      <PageTasks page={page} status={status} onPick={onPick} />
      <p className="mini">Die Seite ist gespeichert. Du findest sie wieder unter „Meine Übungen“ bei „Aus meinen Fotos“.</p>
    </Screen>
  )
}
