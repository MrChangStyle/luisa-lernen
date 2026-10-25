import { useEffect, useRef, type ReactNode } from 'react'
import { Henni } from './Art'
import { AnimalIcon } from './Art'
import { FARM_ORDER, animalName } from '../logic/farm'
import type { Farm } from '../types'

// top: ändert sich der Wert (z. B. neuer Schritt), beginnt die Ansicht wieder ganz oben
export function Screen({ children, foot, top }: { children: ReactNode; foot?: ReactNode; top?: string }) {
  const view = useRef<HTMLElement>(null)
  useEffect(() => view.current?.scrollTo({ top: 0 }), [top])
  return (
    <div className="screen">
      <main className="view" ref={view}>
        {children}
      </main>
      {foot && <footer className="foot">{foot}</footer>}
    </div>
  )
}

export function HenniSays({ children, big }: { children: ReactNode; big?: boolean }) {
  return (
    <div className={`hen-row${big ? ' big' : ''}`}>
      <div className="hen-t">
        <Henni size={big ? 84 : 64} />
        <span>Henni</span>
      </div>
      <div className="bubble">{children}</div>
    </div>
  )
}

export function Ladder({ farm }: { farm: Farm }) {
  return (
    <div className="ladder">
      {FARM_ORDER.map((k) => (
        <div key={k}>
          <AnimalIcon kind={k} />
          <b>{farm[k]}</b>
          <span>{animalName(k, farm[k])}</span>
        </div>
      ))}
    </div>
  )
}

export function EggBar({ farm }: { farm: Farm }) {
  const left = 10 - farm.egg
  return (
    <>
      <div className="bar10" role="img" aria-label={`${farm.egg} von 10 Eiern`}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < farm.egg ? 'on' : ''} />
        ))}
      </div>
      <div className="mini">
        {farm.egg} von 10 Eiern. Noch {left} {animalName('egg', left)} bis zum nächsten Küken.
      </div>
    </>
  )
}
