# Manu — lokaler Vermieter- und Finanz-Tresor

Helle, moderne Web-App. Kein Build, keine Server, läuft in jedem
modernen Browser. Daten bleiben lokal im Browser des Geräts.

## Live

→ **https://joop973.github.io/manu-app/**

Auf dem Handy: URL in Safari/Chrome öffnen → Lesezeichen oder
„Zum Home-Bildschirm hinzufügen".

## Start lokal

**Variante 1 — Doppelklick:** `index.html` öffnen → läuft direkt als `file://`.

**Variante 2 — lokaler Server (empfohlen):**

```bash
python3 -m http.server 8080
# Browser → http://localhost:8080/
```

## GitHub Pages aktivieren (einmalig)

Repo → **Settings → Pages** → Source: „Deploy from a branch" →
Branch: `main`, Folder: `/ (root)` → Save. Nach 30–60 s ist die
Live-URL erreichbar.

## Sicherheit

| Mechanismus | Details |
|---|---|
| **PIN** | PBKDF2-SHA-256 mit 200 000 Iterationen + per-Installation zufälligem 16-Byte-Salt. Migration vom alten SHA-256-Hash beim ersten Login. |
| **Brute-Force-Schutz** | 5 Fehlversuche → 30 s, 10 → 5 min, 15 → 30 min, 20 → 2 h, 25 → 24 h Cooldown. UI zeigt Countdown. |
| **Backup-Export** | Mit Passphrase verschlüsselt (PBKDF2 + AES-GCM-256). Klartext-Exports werden nicht mehr erzeugt; alte Klartext-Backups bleiben lesbar. |
| **Auto-Lock** | Konfigurierbar (1/5/15/30 min Inaktivität). Tab-Wechsel oder Tab-Hidden sperrt sofort. |
| **CSP** | Strikt: nur eigene Ressourcen, keine externen Skripte / Stylesheets / Schriften erlaubt. |
| **Externe Quellen** | Keine. Inter + Source Serif Variable werden lokal aus `/fonts` geladen. Google Fonts ist entfernt. |
| **Berater-Modus** | Beleg-Bilder + eingebettete PDFs werden im Berater- und Print-Modus ausgeblendet, damit Drucke keine Bilder preisgeben. |

## Daten

- **localStorage** unter Key `manu.v1` — strukturierte Daten
- **IndexedDB** `manu-files` — Belege + Dokumente als Blob
- **Backup-Datei** (JSON) — verschlüsselt mit eigener Passphrase

## Design

- **Default:** helles, modernes Theme mit Smaragd-Akzent und warmem Goldton
- **Dunkles Theme** als Option, **Automatisch** folgt dem System
- Typografie: **Inter Variable** (Body, Zahlen) + **Source Serif 4 Variable** (Display, „Manu"-Logo)
- Selbst-gehostet im `/fonts`-Ordner — keine Anfragen an Google
- Soft shadows, 22-Pixel-Karten-Radius, subtile Hover-Lifts und Saldo-Animationen
- Mobile: Bottom-Tab-Bar, `safe-area-insets`-aware

## Ordner-Struktur

```
manu-app/
├── index.html      Skeleton mit CSP, Mount-Points, SVG-Sprite
├── app.css         Design-System (Light-Default + Dark / Auto)
├── app.js          Logik (Store, Router, Views, Crypto)
├── fonts/
│   ├── Inter-Variable.woff2
│   └── SourceSerif.woff2
└── README.md
```

## Bewusst nicht drin

- Kamera-Scans, Push-Notifications, Cloud-Sync, Multi-User-Rollen
- Recovery-Code (geplant in nächster Iteration; PIN-Verlust = Daten weiterhin verschlüsselt im Backup)
