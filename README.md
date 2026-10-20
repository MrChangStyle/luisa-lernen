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

## Stand

- Foto: Henni liest die Aufgabe und fragt „Ist das die richtige Aufgabe?“. Ist das Foto unlesbar, sagt Henni, was Luisa tun kann.
- Meine Übungen: Ein Tipp auf ein Thema startet sofort eine neue Aufgabe dazu. „+ Auswahl“ legt das Thema in „Meine Auswahl“; dort startet ein Tipp ebenfalls sofort. Offene Übungen starten auch mit einem Tipp.
- Alles wird nur auf dem Gerät gespeichert (localStorage). Die Eltern-PIN schützt nur vor versehentlichem Öffnen.
- Die Server-Funktion hat noch keine Anmeldung. Wer die Adresse kennt, kann Aufgaben erstellen lassen, die über den Schlüssel bezahlt werden.

## Nächste Schritte

1. Familien-Datenbank (z. B. Supabase, EU): Konten für Luisa, Mama und Papa, Verlauf auf allen Geräten, und damit auch eine Anmeldung für die Server-Funktion.
2. Antworten auf dem Server prüfen, damit keine Lösung im Handy liegt.
