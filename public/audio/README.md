# Audio-Slots (Platzhalter)

Echte Audiodateien werden **separat beschafft** und hier abgelegt. Der Code
referenziert die Dateinamen über `src/game/assets.ts`. Erwartete Dateien:

| Datei              | Event                          |
|--------------------|--------------------------------|
| `dice-roll.mp3`    | Würfelwurf                     |
| `crown-change.mp3` | Käse-Krone wechselt den Halter |
| `score-tick.mp3`   | Punkte-Hochzählen              |
| `draft-pick.mp3`   | Würfel aus dem Angebot gewählt |
| `round-change.mp3` | Rundenübergang                 |
| `victory.mp3`      | Sieger-Sequenz                 |
| `warn.mp3`         | Negative Rot-/Sabotage-Wertung |

Solange keine Datei existiert, bleiben die Sound-Hooks stumm (kein Fehler).
