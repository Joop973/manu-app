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
| **Tresor-Verschlüsselung** | AES-GCM-256. Master-Key wird via PBKDF2-SHA-256 (200 000 Iter, per-Install-Salt) aus dem PIN abgeleitet, lebt nur im RAM. State + Belege werden beim Schreiben verschlüsselt; localStorage- und IndexedDB-Inhalte sind ohne PIN unlesbar. |
| **Recovery-Code** | Beim ersten PIN-Setup wird ein 24-stelliger Notfall-Code in 5er-Gruppen erzeugt. Damit lässt sich der PIN zurücksetzen, ohne Datenverlust. Der Code wird nur einmal angezeigt; ohne ihn und ohne PIN sind die Daten unwiederbringlich. |
| **Brute-Force-Schutz** | 5 Fehlversuche → 30 s, 10 → 5 min, 15 → 30 min, 20 → 2 h, 25 → 24 h Cooldown. UI zeigt Countdown. |
| **Backup-Export** | Mit Passphrase verschlüsselt (PBKDF2 + AES-GCM-256). Klartext-Exports werden nicht mehr erzeugt; alte Klartext-Backups bleiben lesbar. |
| **Auto-Lock** | Konfigurierbar (1/5/15/30 min Inaktivität). Tab-Wechsel oder Tab-Hidden wipt den Master-Key sofort aus dem Speicher. |
| **CSP** | Strikt: nur eigene Ressourcen, keine externen Skripte / Stylesheets / Schriften erlaubt. |
| **Externe Quellen** | Keine. Inter + Source Serif Variable werden lokal aus `/fonts` geladen. Google Fonts ist entfernt. |
| **Berater-Modus** | Beleg-Bilder + eingebettete PDFs werden im Berater- und Print-Modus ausgeblendet, damit Drucke keine Bilder preisgeben. |
| **Onboarding-Wizard** | Erster Start führt durch Theme, PIN-Setup mit Recovery-Code-Anzeige und Anlage der ersten Eiche. |

## Daten

| Key | Inhalt |
|---|---|
| `localStorage[manu.v1]` | Klartext-State (nur wenn kein PIN gesetzt) |
| `localStorage[manu.v2]` | AES-GCM-verschlüsselter State (wenn PIN gesetzt) |
| `localStorage[manu.meta]` | PIN- und Recovery-Envelopes, Brute-Force-Counter (Klartext-Metadaten, enthält keine Geheimnisse) |
| `IndexedDB[manu-files/receipts]` | Beleg-Blobs — verschlüsselt sobald PIN aktiv |
| Backup-Datei (`.json`) | Mit eigener Passphrase verschlüsselt (PBKDF2 + AES-GCM-256) |

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

- Kamera-Scans (Datei-Upload deckt das ab)
- Push-Notifications, Cloud-Sync, Multi-User-Rollen
- PWA-Installation (Manifest + Service Worker) — kann nachgezogen werden
