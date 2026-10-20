import { Fragment, type ReactNode } from 'react'

// Rendert die einfache Auszeichnung aus dem Lernpfad: **fett**, [[Fachwort]], {z/n}, Absätze und Zeilen.
export function Frac({ n, d }: { n: ReactNode; d: ReactNode }) {
  return (
    <span className="frac" role="math" aria-label={`${n} von ${d}`}>
      <span>{n}</span>
      <hr />
      <span>{d}</span>
    </span>
  )
}

function inline(text: string, onTerm?: (t: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[\[(.+?)\]\]|\{([^{}/]+)\/([^{}/]+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<b key={i++}>{inline(m[1], onTerm)}</b>)
    else if (m[2]) {
      const t = m[2]
      out.push(
        <button key={i++} type="button" className="term" onClick={() => onTerm?.(t)}>
          {t}
        </button>,
      )
    } else out.push(<Frac key={i++} n={m[3].trim()} d={m[4].trim()} />)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Rich({ text, onTerm }: { text: string; onTerm?: (t: string) => void }) {
  return (
    <>
      {text.split('\n\n').map((para, p) => (
        <p key={p}>
          {para.split('\n').map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {inline(line, onTerm)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  )
}

export const Inline = ({ text }: { text: string }) => <>{inline(text)}</>
