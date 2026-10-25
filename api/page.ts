import Anthropic from '@anthropic-ai/sdk'

// Liest eine fotografierte Schulbuch- oder Arbeitsblattseite und listet die Aufgaben darauf.
// Kein Lernpfad, keine Lösungen: nur Abschreiben. Deshalb mit wenig Aufwand und kleinem Token-Rahmen.
// Die Seite wird in der App gespeichert, damit sie später nicht noch einmal gelesen werden muss.

export const SUBJECT_NAMES = ['Mathe', 'Deutsch', 'Englisch', 'NT', 'Biologie', 'GPG'] as const

export interface AiPage {
  readable: boolean
  problem: string
  subject: string
  title: string
  tasks: { label: string; topic: string; text: string }[]
}

const str = { type: 'string' }
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

export const PAGE_SCHEMA = obj({
  readable: { type: 'boolean' },
  problem: str,
  subject: { type: 'string', enum: [...SUBJECT_NAMES] },
  title: str,
  tasks: { type: 'array', items: obj({ label: str, topic: str, text: str }) },
})

export const PAGE_PROMPT = `Du liest für eine Lern-App eine fotografierte Seite aus einem Schulbuch oder Arbeitsblatt (6. Klasse Mittelschule, Bayern). Die Schülerin heißt Luisa.

Deine Aufgabe ist nur das genaue Abschreiben, nie das Lösen:
- tasks: jede Aufgabe auf der Seite, in der Reihenfolge der Seite. Teilaufgaben (a, b, c …) gehören zu ihrer Aufgabe, außer sie sind lang und eigenständig.
- label: kurz, wie auf der Seite, z. B. „Aufgabe 3“ oder „Nr. 5 a–c“. Ohne Nummer: „Aufgabe oben“, „Aufgabe unten“.
- text: die vollständige Aufgabe, so dass man sie ohne das Foto lösen kann. Schreibe gemeinsame Einleitungstexte, Tabellen (als Text) und Zahlen mit hinein. Beschreibe Bilder, die man zum Lösen braucht, in einem Satz. Brüche als {3/4}. Keine Lösung, keine Hinweise.
- topic: das Thema in 1 bis 4 Wörtern, z. B. „Brüche kürzen“.
- subject: das Fach. title: ein kurzer Name für die Seite, z. B. „Brüche kürzen, Seite 42“, mit Seitenzahl, wenn sie zu sehen ist.
- Bereits gelöste Beispielaufgaben, Merkkästen und reine Erklärtexte sind keine Aufgaben.
- readable ist true, problem ist leer.

Wenn das Foto nicht lesbar ist oder keine Aufgabe zeigt: readable false, problem ein ruhiger Satz an Luisa, was sie tun kann (z. B. „Das Foto ist zu dunkel. Mache bitte ein neues Foto mit mehr Licht.“), title leer, tasks leer.`

const MODEL = 'claude-opus-5-5'

export async function readPage(client: Anthropic, image: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<{ page: Omit<AiPage, 'readable' | 'problem'> } | { problem: string }> {
  const message = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 12000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PAGE_SCHEMA } },
      system: PAGE_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Luisa hat diese Seite fotografiert. Liste die Aufgaben darauf.' },
          ],
        },
      ],
    })
    .finalMessage()
  if (message.stop_reason === 'refusal') throw new Error('Die KI hat diese Seite abgelehnt.')
  if (message.stop_reason === 'max_tokens') throw new Error('Die Seite war zu lang zum Lesen.')
  const ai = JSON.parse(message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as AiPage
  const tasks = ai.tasks.filter((t) => t.text.trim()).slice(0, 20)
  if (!ai.readable || tasks.length === 0) return { problem: ai.problem || 'Ich finde auf dem Foto keine Aufgabe. Mache bitte ein neues Foto von der Seite.' }
  return { page: { subject: ai.subject, title: ai.title || ai.tasks[0].topic, tasks } }
}

const json = (data: unknown, status = 200) => Response.json(data, { status })

function detailOf(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    const body = e.error as { error?: { type?: string; message?: string } } | undefined
    return `Anthropic ${e.status ?? '?'}: ${body?.error?.message ?? e.message}`.slice(0, 300)
  }
  return e instanceof Error ? e.message.slice(0, 300) : String(e)
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'Die KI ist noch nicht eingerichtet. Ein Elternteil muss den Schlüssel bei Vercel eintragen.' }, 503)
  }
  const b = (await request.json().catch(() => null)) as { image?: unknown; mediaType?: unknown } | null
  const ok = typeof b?.image === 'string' && b.image.length > 0 && b.image.length <= 7_000_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(b.mediaType as string)
  if (!ok) return json({ error: 'Die Anfrage war unvollständig.' }, 400)
  try {
    return json(await readPage(new Anthropic(), b!.image as string, b!.mediaType as 'image/jpeg'))
  } catch (e) {
    console.error(e)
    const text = e instanceof Anthropic.APIError ? 'Die KI ist gerade nicht erreichbar.' : e instanceof Error ? e.message : 'Unbekannter Fehler.'
    return json({ error: `${text} Bitte versuche es gleich noch einmal.`, detail: detailOf(e) }, 502)
  }
}
