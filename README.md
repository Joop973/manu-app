# Dice Mice 🧀🐭

Ein eigenständiges Würfelspiel mit Mäuse-Thema (React + Vite, später PWA und
Capacitor/iOS). Eigener Name, eigene Grafiken und Regeltexte.

## Schnellstart

```bash
npm install
npm run dev       # Entwicklungsserver (http://localhost:5173)
npm test          # Engine-Unit-Tests (Vitest)
npm run build     # Produktions-Build inkl. PWA-Service-Worker
npm run preview   # Build lokal ansehen
```

## Architektur

Engine und Transport/UI sind **strikt getrennt**, damit dieselbe Engine lokal
(Pass-and-Play, Solo) und später online läuft.

```
.
├── index.html
├── vite.config.ts            Vite + PWA (manifest, Service Worker)
├── public/
│   ├── icons/                Platzhalter-Icons (echte separat beschaffen)
│   ├── audio/                Sound-Slots (Platzhalter, siehe README dort)
│   └── characters/           Maus-Grafik-Slots (Platzhalter)
└── src/
    ├── game/                 reine Spiel-Engine (kein UI/Netzwerk)
    │   ├── types.ts          zentrale Typen
    │   ├── rng.ts            seedbarer Zufallsgenerator (deterministisch)
    │   ├── dice.ts           Würfelkatalog, Faces, Würfeln
    │   ├── scoring.ts        Rundenwertung + Tie-Breaks
    │   ├── engine.ts         Zustandsmaschine (10 Runden × 4 Phasen)
    │   ├── assets.ts         Slots für Sounds/Charaktere (Phase 5)
    │   └── __tests__/        Unit-Tests je Wertungsregel
    └── ui/                   Pass-and-Play-Oberfläche (CSS-Würfel)
```

## Spielregeln (umgesetzt)

- **10 Runden.** Jede Maus startet mit 1 gelben W6.
- **Vier Phasen pro Runde:** 1) Würfeln 2) Mitleidswürfel 3) Klar-Würfel
  tauschen 4) Drafting.
- **Käse-Krone:** höchste Gelb-Summe.
- Der Würfelbeutel ist eine **Liste** von Würfel-Definitionen (Farbe + Seiten);
  mehrere Würfel pro Farbe sind möglich.

### Würfelkatalog

| Farbe    | Würfel          | Wertung |
|----------|-----------------|---------|
| Gelb     | W6, W8          | höchste Gelb-Summe → Käse-Krone |
| Grün     | W20             | Standard-Summe |
| Blau     | W6, W8, W12 (+Glitzer) | Blau & Blau-Glitzer = eine Farbe für Orange |
| Lila     | W8, W12         | Standard-Summe |
| Rot      | W6, W8          | Faces positiv **und** negativ |
| Klar     | W6              | in der Tausch-Phase neu werfbar |
| Pink     | W12             | Standard-Summe |
| Orange   | W3              | Wert × Anzahl verschiedener Farben der Runde |
| Sabotage | W8, W12         | Summe wird dem Kronenhalter abgezogen |
| Braun    | Faces {2,3} konfigurierbar | Summe × größte passende Gruppe |

Rote und braune Face-Werte sind in `src/game/dice.ts` zentral konfigurierbar
(`RED_FACES`, `BROWN_PRESETS`: `standard` {2,3}, `low` {1,2}, `wide` {1,2,3}).

## Aufgelöste offene Entscheidungen

- **Orange + Sabotage – Timing:** Die gesamte Wertung erfolgt **am Rundenende**
  aus einem Würfel-Schnappschuss in fester Reihenfolge
  (Basis → Käse-Krone → Sabotage). Sabotage liest nur die Basiswerte, nie die
  bereits sabotierten Werte → keine Reihenfolge-Mehrdeutigkeit, keine
  Zirkelbezüge. Details als Kommentar in `src/game/scoring.ts`.
- **Braun – Balance:** Face-Werte über `BROWN_PRESETS` konfigurierbar.
- **Sabotage – Balance:** rein mechanisch umgesetzt; Feinjustierung im
  Playtesting.

## Entwicklungsstand (Phasen aus dem Bauplan)

- ✅ **Phase 0** – React-+-Vite-Setup, PWA-Gerüst (manifest, Service Worker,
  Platzhalter-Icons).
- ✅ **Phase 1** – Engine als `src/game/*` herausgelöst: alle 10 Farben inkl.
  Orange/Sabotage/Braun, vier Phasen, Wertung, Tie-Breaks, Käse-Krone,
  Mitleidswürfel, Tausch, Draft. **41 Unit-Tests** (Engine, Wertung, KI).
- ✅ **Phase 2** – UI an die Engine angebunden: Setup-Screen, alle vier Phasen
  sichtbar, Pass-and-Play. (3D-Würfel/Politur folgen in Phase 4/5.)
- ✅ **Phase 3** – KI-Gegner (Solo): reine Entscheidungsfunktionen in
  `src/game/ai.ts`, drei Schwierigkeitsgrade (easy/normal/hard), automatischer
  Tausch- und Draft-Zug. Bewusst gekapselt, damit dieselbe KI später
  serverseitig bei Spielerausfällen (Timeout) einspringen kann. 9 Unit-Tests.
- ◻️ **Phase 4** – 3D-Würfel (react-three-fiber).
- ◻️ **Phase 5** – Sound + Animationen (Slots vorbereitet in `assets.ts`).
- ◻️ **Phase 6** – Online-Multiplayer (Engine ist bereits transport-unabhängig).
- ◻️ **Phase 7** – PWA-Feinschliff, Deployment (Netlify), Capacitor-Vorbereitung.
