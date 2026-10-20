import { next } from '@vercel/functions'

// Passwortschutz für die ganze App: Ohne gültiges Cookie zeigt Vercel nur die Anmeldeseite.
// Das Passwort steht in der Vercel-Umgebungsvariable APP_PASSWORD. Wird es geändert,
// sind alle Geräte abgemeldet, weil das Cookie aus dem Passwort abgeleitet ist.

export const config = { runtime: 'nodejs' }

const COOKIE = 'luisa_zugang'
const YEAR = 60 * 60 * 24 * 365

async function token(password: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('luisa-lernen-zugang-v1'))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Vergleich in gleicher Zeit, egal wo sich die Zeichen unterscheiden
function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function cookie(request: Request, name: string) {
  const all = request.headers.get('cookie') ?? ''
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

const page = (message: string, status: number) =>
  new Response(
    `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Luisa lernt</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f5ef; color: #1f2a2e;
    font: 17px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width: min(340px, calc(100vw - 32px)); display: grid; gap: 12px; background: #fff; border: 1px solid #ddd8cc;
    border-radius: 14px; padding: 22px; }
  h1 { margin: 0; font-size: 1.4rem; }
  p { margin: 0; color: #5d6a6e; font-size: .95rem; }
  input { font: inherit; padding: 10px 12px; border: 2px solid #ddd8cc; border-radius: 10px; }
  button { font: inherit; font-weight: 700; padding: 12px; border: 0; border-radius: 12px; background: #2f6f73; color: #fff; }
  .msg { color: #9a5b00; }
</style>
</head>
<body>
<form method="post" action="/__anmelden">
  <h1>Luisa lernt</h1>
  <p>Bitte gib das Familien-Passwort ein. Danach merkt sich dieses Gerät die Anmeldung.</p>
  ${message ? `<p class="msg" role="alert">${message}</p>` : ''}
  <input type="password" name="passwort" autocomplete="current-password" aria-label="Passwort" required autofocus>
  <button type="submit">Öffnen</button>
</form>
</body>
</html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )

export default async function middleware(request: Request) {
  const password = process.env.APP_PASSWORD
  if (!password) return page('Das Passwort ist noch nicht eingerichtet. Ein Elternteil muss APP_PASSWORD in Vercel eintragen.', 503)
  const expected = await token(password)
  const url = new URL(request.url)

  if (url.pathname === '/__anmelden' && request.method === 'POST') {
    const form = await request.formData().catch(() => null)
    const given = String(form?.get('passwort') ?? '')
    if (given && same(await token(given), expected)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: '/',
          'set-cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
          'cache-control': 'no-store',
        },
      })
    }
    // Kurze Pause bremst das Durchprobieren von Passwörtern
    await new Promise((r) => setTimeout(r, 1000))
    return page('Das Passwort passt nicht. Bitte versuche es noch einmal.', 401)
  }

  if (same(cookie(request, COOKIE) ?? '', expected)) return next()
  if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Bitte melde dich zuerst mit dem Familien-Passwort an. Lade die Seite neu.' }, { status: 401 })
  return page('', 401)
}
