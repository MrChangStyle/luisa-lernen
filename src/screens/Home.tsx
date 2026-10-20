import { Face } from '../components/Art'
import { HenniSays, Screen } from '../components/Ui'
import { moodText } from '../logic/mood'

interface Props {
  mood: number
  moodSavedAt: string | null
  onMood: (v: number) => void
  go: (s: 'camera' | 'practice' | 'farm' | 'family') => void
}

export function Home({ mood, moodSavedAt, onMood, go }: Props) {
  return (
    <Screen
      foot={
        <>
          <button className="btn" onClick={() => go('camera')}>
            Aufgabe fotografieren
          </button>
          <div className="row2">
            <button className="btn sec" onClick={() => go('practice')}>
              Meine Übungen
            </button>
            <button className="btn sec" onClick={() => go('farm')}>
              Mein Bauernhof
            </button>
          </div>
          <button className="link" onClick={() => go('family')}>
            Familienbereich (für Eltern)
          </button>
        </>
      }
    >
      <HenniSays big>
        <div className="s-title small">Hallo Luisa.</div>
        <div>Ich bin Henni, dein Lehrerhuhn. Ich erkläre dir heute deine Aufgaben, Schritt für Schritt.</div>
      </HenniSays>
      <section className="card mood">
        <label htmlFor="mood" className="q">
          Wie geht es dir gerade?
        </label>
        <Face value={mood} />
        <div className="mood-label">{moodText(mood)}</div>
        <input id="mood" type="range" min={0} max={100} value={mood} onChange={(e) => onMood(Number(e.target.value))} />
        <div className="range-ends mini">
          <span>schlecht</span>
          <span>sehr gut</span>
        </div>
        {moodSavedAt && <div className="mini">✓ Deine Stimmung für heute ist gespeichert ({moodSavedAt}).</div>}
        {mood < 30 && <div className="mini">Wenn du möchtest, mach zuerst eine kurze Pause. Du kannst auch mit einer leichten Übung anfangen.</div>}
      </section>
    </Screen>
  )
}
