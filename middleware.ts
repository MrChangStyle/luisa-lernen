import { next } from '@vercel/functions'
import { DbError, db, sendEmailCode, verifyEmailCode } from './server/db.js'
import {
  DEVICE_COOKIE,
  DEVICE_DAYS,
  LEGACY_COOKIE,
  PARENT_COOKIE,
  PARENT_DAYS,
  clearCookie,
  codeHash,
  expiry,
  legacyToken,
  same,
  sessionKey,
  sessionOf,
  setCookie,
  sign,
} from './server/session.js'

// Zugang zur App. Ohne gültige Anmeldung zeigt Vercel nur die Anmeldeseite. Drei Wege:
// 1. Kindergerät: Die Eltern erzeugen im Elternbereich einen Einmal-Code, das Kind gibt ihn hier ein.
//    Danach sieht dieses Gerät nur dieses eine Kind.
// 2. Eltern: Anmeldung mit E-Mail und Code (Supabase Auth).
// 3. Bisheriges Familien-Passwort (APP_PASSWORD). Bleibt, bis alle Geräte umgestellt sind.

export const config = { runtime: 'nodejs' }

const YEAR = 60 * 60 * 24 * 365

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const shell = (body: string, status: number, extra: Record<string, string> = {}) =>
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
  main { width: min(360px, calc(100vw - 32px)); display: grid; gap: 14px; padding: 24px 0; }
  form, details { display: grid; gap: 10px; background: #fff; border: 1px solid #ddd8cc; border-radius: 14px; padding: 18px; }
  summary { cursor: pointer; font-weight: 700; }
  details[open] summary { margin-bottom: 8px; }
  h1 { margin: 0; font-size: 1.4rem; }
  h2 { margin: 0; font-size: 1.1rem; }
  p { margin: 0; color: #5d6a6e; font-size: .95rem; }
  input { font: inherit; padding: 10px 12px; border: 2px solid #ddd8cc; border-radius: 10px; }
  input.code { font-size: 1.6rem; letter-spacing: .3em; text-align: center; }
  button { font: inherit; font-weight: 700; padding: 12px; border: 0; border-radius: 12px; background: #2f6f73; color: #fff; }
  .msg { color: #9a5b00; }
</style>
</head>
<body><main>${body}</main></body>
</html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra } },
  )

const msg = (m: string) => (m ? `<p class="msg" role="alert">${esc(m)}</p>` : '')

function startPage(message = '', status = 401) {
  const legacy = process.env.APP_PASSWORD
    ? `<details><summary>Familien-Passwort (bisheriger Zugang)</summary>
  <form method="post" action="/__anmelden" style="border:0;padding:0">
    <input type="password" name="passwort" autocomplete="current-password" aria-label="Familien-Passwort" required>
    <button type="submit">Öffnen</button>
  </form></details>`
    : ''
  return shell(
    `<h1>Luisa lernt</h1>
${msg(message)}
<form method="post" action="/__geraet">
  <h2>Für Kinder: Gerät einrichten</h2>
  <p>Deine Eltern zeigen dir einen Code mit 6 Ziffern. Gib ihn hier ein.</p>
  <input class="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" aria-label="Code" required>
  <button type="submit">Gerät einrichten</button>
</form>
<form method="post" action="/__konto/email">
  <h2>Für Eltern: anmelden</h2>
  <p>Wir schicken dir einen Code per E-Mail. Ein Passwort brauchst du nicht.</p>
  <input type="email" name="email" autocomplete="email" aria-label="E-Mail" required>
  <button type="submit">Code schicken</button>
</form>
${legacy}`,
    status,
  )
}

function emailCodePage(email: string, message = '') {
  return shell(
    `<h1>Code eingeben</h1>
${msg(message)}
<form method="post" action="/__konto/code">
  <p>Wir haben einen Code an <b>${esc(email)}</b> geschickt. Er gilt eine Stunde.</p>
  <input type="hidden" name="email" value="${esc(email)}">
  <input class="code" name="code" inputmode="numeric" pattern="[0-9]{6,10}" maxlength="10" autocomplete="one-time-code" aria-label="Code aus der E-Mail" required autofocus>
  <button type="submit">Anmelden</button>
</form>
<p><a href="/">Andere E-Mail-Adresse</a></p>`,
    401,
  )
}

const redirectHome = (...cookies: string[]) => {
  const headers = new Headers({ location: '/', 'cache-control': 'no-store' })
  for (const c of cookies) headers.append('set-cookie', c)
  return new Response(null, { status: 303, headers })
}

const slow = () => new Promise((r) => setTimeout(r, 1000))

async function form(request: Request) {
  const f = await request.formData().catch(() => null)
  return (name: string) => String(f?.get(name) ?? '').trim()
}

// --- Kindergerät mit Einmal-Code einrichten ---
async function pairDevice(request: Request) {
  const code = (await form(request))('code')
  if (!/^\d{6}$/.test(code)) return startPage('Der Code hat 6 Ziffern.')
  const hash = await codeHash(code)
  const row = (await db.select<{ child_id: string; expires_at: string }>('device_codes', `${db.eq('code_hash', hash)}&select=child_id,expires_at`))[0]
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    await slow()
    return startPage('Der Code passt nicht oder ist abgelaufen. Bitte deine Eltern um einen neuen.')
  }
  await db.remove('device_codes', db.eq('code_hash', hash))
  const ua = request.headers.get('user-agent') ?? ''
  const label = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät'
  const [dev] = await db.insert<{ id: string }>('devices', { child_id: row.child_id, label })
  const value = await sign({ r: 'kind', d: dev.id, c: row.child_id, exp: expiry(DEVICE_DAYS) })
  return redirectHome(setCookie(DEVICE_COOKIE, value!, DEVICE_DAYS), clearCookie(PARENT_COOKIE))
}

// --- Eltern: E-Mail-Code anfordern und prüfen ---
async function requestParentCode(request: Request) {
  const email = (await form(request))('email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return startPage('Bitte eine gültige E-Mail-Adresse eingeben.')
  try {
    await sendEmailCode(email)
  } catch (e) {
    console.error(e)
    return startPage('Der Code konnte gerade nicht verschickt werden. Bitte versuche es in ein paar Minuten noch einmal.', 502)
  }
  return emailCodePage(email)
}

async function checkParentCode(request: Request) {
  const get = await form(request)
  const email = get('email').toLowerCase()
  const code = get('code')
  if (!/^\d{6,10}$/.test(code)) return emailCodePage(email, 'Bitte den Code aus der E-Mail eingeben.')
  const user = await verifyEmailCode(email, code)
  if (!user) {
    await slow()
    return emailCodePage(email, 'Der Code passt nicht oder ist abgelaufen.')
  }
  const known = (await db.select<{ user_id: string }>('parents', `${db.eq('user_id', user.id)}&select=user_id`))[0]
  if (!known) await db.insert('parents', { user_id: user.id, email: user.email })
  const value = await sign({ r: 'eltern', u: user.id, exp: expiry(PARENT_DAYS) })
  // Auf einem Kindergerät meldet sich kein Elternteil an: Das Gerät bleibt beim Kind.
  return redirectHome(setCookie(PARENT_COOKIE, value!, PARENT_DAYS))
}

// --- Bisheriges Familien-Passwort ---
async function legacyLogin(request: Request) {
  const password = process.env.APP_PASSWORD
  const given = (await form(request))('passwort')
  if (password && given && same(await legacyToken(given), await legacyToken(password))) {
    const headers = new Headers({ location: '/', 'cache-control': 'no-store' })
    headers.append('set-cookie', `${LEGACY_COOKIE}=${await legacyToken(password)}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`)
    return new Response(null, { status: 303, headers })
  }
  await slow()
  return startPage('Das Passwort passt nicht. Bitte versuche es noch einmal.')
}

export default async function middleware(request: Request) {
  if (!process.env.APP_PASSWORD && !sessionKey()) {
    return shell('<h1>Luisa lernt</h1><p>Der Zugang ist noch nicht eingerichtet. Ein Elternteil muss APP_PASSWORD oder SUPABASE_SECRET_KEY in Vercel eintragen.</p>', 503)
  }
  const url = new URL(request.url)
  const post = request.method === 'POST'
  try {
    if (post && url.pathname === '/__anmelden') return await legacyLogin(request)
    if (post && url.pathname === '/__geraet') return await pairDevice(request)
    if (post && url.pathname === '/__konto/email') return await requestParentCode(request)
    if (post && url.pathname === '/__konto/code') return await checkParentCode(request)
  } catch (e) {
    console.error(e)
    return startPage(e instanceof DbError ? 'Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.' : 'Etwas ist schiefgegangen.', 502)
  }
  if (url.pathname === '/__abmelden') {
    // Nur Eltern melden sich ab. Ein Kindergerät wird im Elternbereich entfernt.
    return redirectHome(clearCookie(PARENT_COOKIE))
  }

  if (await sessionOf(request)) return next()
  if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Bitte melde dich zuerst an. Lade die Seite neu.' }, { status: 401 })
  return startPage()
}
