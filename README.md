# Manu — Deep Jungle Web-App

Voll funktionierende Single-Page-Web-App im **Deep-Jungle-Design** (Steuer-Edition).
Eine HTML-Datei, kein Build, keine Server, läuft in jedem modernen Browser.

## Live

→ **https://joop973.github.io/manu-app/**

Auf dem Handy: URL in Safari/Chrome öffnen → Lesezeichen oder
„Zum Home-Bildschirm hinzufügen". Daten bleiben lokal im Browser
des Geräts (localStorage + IndexedDB).

## Start lokal

**Variante 1 — Doppelklick:** `index.html` öffnen → läuft direkt als `file://`.

**Variante 2 — lokaler Server:**

```bash
python3 -m http.server 8080
# Browser → http://localhost:8080/
```

## GitHub Pages aktivieren (einmalig)

Repo → **Settings → Pages** → Source: „Deploy from a branch" →
Branch: `main`, Folder: `/ (root)` → Save. Nach 30–60 s ist die
oben genannte URL live.

## Was drin ist

| Bereich | Feature |
|---|---|
| **Hauptsaal** | Bilanz, Steuerjahres-Anzeige, 6-Monats-Chart, Eichen-Karten |
| **Buchungen** | Tabelle mit Filtern (Monat / Typ / Objekt / Suche / nur steuerrelevant), Bulk-Edit, Calculator-Eingabe, Wiederholungen, Tags |
| **Eiche** | Pro Objekt P&L (1/3/12 Mt), Mieter, Wartungs-Historie, letzte Buchungen, Anlage-V + NK-Abrechnung |
| **Belege** | Foto / PDF / Word hochladen → IndexedDB, Filename-Parser für Betrag/Datum/Empfänger, „Als Buchung übernehmen" |
| **Steuer (Berater)** | Berater-Modus-Toggle, Steuer-Akzent automatisch aus Kategorie, Ernte-Korb → PDF / CSV / DATEV / Anlage V |
| **Werkzeuge** | Subscription Detector, Top-Kategorien, Sparziele, Verträge, Handwerker, Brutto/Netto-Rechner, CSV-Import (DKB/Sparkasse/ING/N26) |
| **Einstellungen** | PIN-Schutz (SHA-256), Auto-Lock, Theme (Deep Jungle / Salbei), DE/EN, Schriftgröße, Backup-Export/Import, Papierkorb |

## Design-System

- **Basis:** `#08140E` Deep Forest
- **Karten:** `#0F2419` Forest Card
- **Holz (Belege):** `#2B1B12` Dark Wood
- **Grüntöne pro Kategorie:** Moos (Fixkosten), Smaragd (Mieten), Salbei (Reparaturen)
- **Steuer-Akzent:** `#D4AF37` Golden Oak — **ausschließlich** für steuerrelevante Posten
- **Schrift:** Lora (Serif, Bezeichnungen) + Inter (Sans, Zahlen)
- **Metaphern:** Immobilien-Eiche (Äste = Objekte), Blätter (Belege), Wurzel-Archiv (Vorjahre), Ernte-Korb (Steuer-Export)

## Daten

- **localStorage** unter Key `manu.v1` — strukturierte Daten (Buchungen, Mieter, Kategorien, …)
- **IndexedDB** `manu-files` — Belege + Dokumente als Blob
- **Backup-Datei** (JSON) enthält alles inkl. Belege als Base64

## Steuer-Akzent automatisch

Kategorien tragen ein `taxRelevant`-Flag. Buchungen in solchen Kategorien
bekommen automatisch:
- linke Gold-Kante in der Liste (`gold-row`)
- Stern-Punkt (`★`) am Ende der Zeile
- Aufnahme in den Berater-Modus + alle Steuer-Exporte

In den Einstellungen → Kategorien lässt sich das Flag pro Kategorie schalten.

## Berater-Modus

Toggle oben rechts blendet das Casino-Look aus und zeigt:
- Schlichten weißen Hintergrund
- Druckfertige Tabelle ohne Spielereien
- Browser-Drucken (Cmd/Ctrl+P) liefert sauberes PDF

## Ernte-Korb (Steuer-Export)

Im Steuer-Tab gibt es vier Export-Wege:
- **PDF** via `window.print` mit dedizierter `@media print`-CSS
- **CSV** mit Semikolon-Trenner (deutsche Excel-Konvention)
- **DATEV-CSV** mit Konten-Mapping pro Kategorie
- **Anlage V** PDF pro Objekt — mit AfA aus Property-Stammdaten

## Bewusst nicht drin

- Kamera-Scans (PWA-Erweiterung möglich)
- Push-Notifications (Browser-Notification-API möglich)
- Cloud-Sync (Backup-Datei ist die Brücke)
- Multi-User mit Rollen
