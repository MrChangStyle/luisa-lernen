import { AnimalIcon } from '../components/Art'
import { EggBar, Ladder, Screen } from '../components/Ui'
import type { Animal } from '../logic/farm'
import type { Farm } from '../types'

const many = (kind: Animal, n: number) => Array.from({ length: n }, (_, i) => <AnimalIcon key={`${kind}${i}`} kind={kind} />)

export function FarmScreen({ farm, onBack }: { farm: Farm; onBack: () => void }) {
  return (
    <Screen
      foot={
        <button className="btn sec" onClick={onBack}>
          Zurück
        </button>
      }
    >
      <div className="s-title">Mein Bauernhof</div>
      <div className="farm">
        <div className="sky">{farm.cow + farm.rooster ? [...many('cow', farm.cow), ...many('rooster', farm.rooster)] : <span className="mini">Hier stehen später deine Hähne und Kühe.</span>}</div>
        <div className="grass">{[...many('hen', farm.hen), ...many('chick', farm.chick)]}</div>
        <div className="nest">{farm.egg ? many('egg', farm.egg) : <span className="mini">Das Nest ist leer.</span>}</div>
      </div>
      <Ladder farm={farm} />
      <EggBar farm={farm} />
      <div className="why">
        <b>So wächst dein Bauernhof</b>
        Für jede richtig fertige Aufgabe bekommst du 1 Ei. 10 Eier werden 1 Küken. 10 Küken werden 1 Huhn. 10 Hühner werden 1 Hahn. 10 Hähne werden 1 Kuh. Tiere gehen nie verloren.
      </div>
    </Screen>
  )
}
