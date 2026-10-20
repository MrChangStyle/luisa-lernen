# Luisa lernen

Lern-App für Luisa (6. Klasse Mittelschule, Bayern). Luisa fotografiert eine Schulaufgabe. Henni, das Lehrerhuhn, erklärt sie Schritt für Schritt und logisch nachvollziehbar, verrät aber nie das Ergebnis. „Erklär es mir nochmal“ zeigt jeden Schritt in drei Fassungen: mit anderen Worten, mit einem Bild und als feste Regel. Zu jeder Aufgabe gibt es zwei neue Übungen, für richtig fertige Aufgaben wächst ein Bauernhof, und im Familienbereich sehen die Eltern, was Luisa gemacht hat.

Konzept-Entwurf: https://claude.ai/artifact/AzpiGtnPbmNchvrctPPpnG

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Prüfungen (Bauernhof, Antwortprüfung, keine Lösung in Erklärtexten)
npm run build    # fertige Web-App in dist/
```

Die App ist eine Web-App (PWA). Auf dem Handy im Browser öffnen und „Zum Startbildschirm hinzufügen“ wählen, dann startet sie wie eine normale App.

## KI einrichten

Den Lernpfad erstellt `api/lesson.ts` mit Claude (Modell `claude-opus-5-5`). Vercel baut die Datei automatisch als Server-Funktion. Dafür braucht das Vercel-Projekt einen API-Schlüssel:

1. Auf https://console.anthropic.com unter „API Keys“ einen Schlüssel erstellen.
2. In Vercel im Projekt „luisa-lernen“ unter **Settings → Environment Variables** den Namen `ANTHROPIC_API_KEY` mit diesem Schlüssel eintragen.
3. Unter **Deployments** beim neuesten Eintrag „Redeploy“ wählen.

Ohne Schlüssel zeigt die App beim Start einer Aufgabe: „Die KI ist noch nicht eingerichtet.“

Ein Lernpfad dauert meistens ein bis zwei Minuten. Der Wächter in `api/lesson.ts` prüft danach, dass kein Ergebnis mit Zahlen in den Erklärungen steht. Findet er eins, schreibt die KI den Lernpfad einmal neu; klappt das auch nicht, bekommt Luisa die Aufgabe nicht.

## Passwort einrichten

Die ganze App ist mit einem Familien-Passwort geschützt (`middleware.ts`). Ohne Anmeldung zeigt Vercel nur die Anmeldeseite, und die KI-Schnittstelle antwortet nicht.

1. In Vercel unter **Settings → Environment Variables** den Namen `APP_PASSWORD` mit dem gewünschten Passwort eintragen.
2. Unter **Deployments** beim neuesten Eintrag „Redeploy“ wählen.

Jedes Gerät meldet sich einmal an und bleibt ein Jahr angemeldet. Wer das Passwort in Vercel ändert, meldet damit alle Geräte ab.

## Cloud einrichten

Alle Daten (Aufgaben, Antworten, Bauernhof, Stimmung, Protokoll) liegen in Supabase in Frankfurt (Projekt `luisa-lernen`, Tabelle `family_data`). Die App spricht nur über `api/data.ts` mit der Datenbank; der Schlüssel bleibt auf dem Server.

1. In Supabase im Projekt **luisa-lernen** unter **Project Settings → API Keys** bei „Secret keys“ den Schlüssel (`sb_secret_…`) kopieren.
2. In Vercel unter **Settings → Environment Variables** den Namen `SUPABASE_SECRET_KEY` mit diesem Schlüssel eintragen.
3. Unter **Deployments** beim neuesten Eintrag „Redeploy“ wählen.

Beim ersten Öffnen lädt jedes Gerät seinen bisherigen Stand hoch; die Stände werden zusammengeführt, nichts geht verloren. Der Familienbereich zeigt, ob alles in der Cloud gespeichert ist.

## Stand

- Foto: Henni liest die Aufgabe und fragt „Ist das die richtige Aufgabe?“. Ist das Foto unlesbar, sagt Henni, was Luisa tun kann.
- Meine Übungen: Ein Tipp auf ein Thema startet sofort eine neue Aufgabe dazu. „+ Auswahl“ legt das Thema in „Meine Auswahl“; dort startet ein Tipp ebenfalls sofort. Offene Übungen starten auch mit einem Tipp.
- Alles liegt in der Cloud und zusätzlich als Kopie auf dem Gerät. Die Eltern-PIN schützt nur vor versehentlichem Öffnen.

## Nächste Schritte

1. Eigene Konten für Luisa, Mama und Papa statt eines Familien-Passworts.
2. Antworten auf dem Server prüfen, damit keine Lösung im Handy liegt.
