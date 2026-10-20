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

## Stand der Testversion

- Alle Bildschirme aus dem Entwurf: Startseite mit Henni und Stimmungsbarometer, Foto, Schritt-für-Schritt-Erklärung, „Erklär es mir nochmal“, Fachwörter zum Antippen, Bauernhof, Meine Übungen mit Fächermenü und Familienbereich mit Eltern-PIN.
- Das Foto wird noch nicht ausgewertet. Danach startet immer die Beispielaufgabe (Brüche addieren).
- Alles wird nur auf dem Gerät gespeichert (localStorage). Die Eltern-PIN schützt nur vor versehentlichem Öffnen.

## Nächste Schritte

1. Server mit KI (Claude über die Anthropic-API): Foto lesen, Lernpfad im Format von `src/types.ts` erstellen, Wächter-Prüfung gegen verratene Lösungen.
2. Familien-Datenbank (z. B. Supabase, EU): Konten für Luisa, Mama und Papa, Verlauf auf allen Geräten.
3. Antworten auf dem Server prüfen, damit keine Lösung im Handy liegt.
