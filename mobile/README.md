# Manu Imperial Finance — Mobile (Expo / React Native)

Native iOS/Android-App im Caesars-Palace-Look mit Buchhaltung, KI-Beleg-Autopilot,
Tresoren, Mieter-/Handwerker-Verwaltung, Jahres-Checkup und mehr — alles lokal,
ohne Cloud-Abhängigkeit.

## Stack

- Expo SDK 52 + Expo Router (file-based)
- TypeScript (strict)
- Zustand + AsyncStorage (persistente Speicherung)
- expo-file-system (lokale Beleg-Ablage)
- expo-camera, expo-image-picker, expo-document-picker (Belege)
- expo-local-authentication (Face ID / Touch ID)
- expo-google-fonts: Cinzel, Cormorant Garamond, Lato

## Setup

```bash
cd mobile
npm install
npx expo prebuild      # erforderlich wegen expo-camera + expo-local-authentication
npx expo run:ios       # oder
npx expo run:android
```

> **Hinweis:** Diese App läuft NICHT in Expo Go, weil sie native Module
> (`expo-camera`, `expo-local-authentication`) verwendet. Du brauchst einen
> Development-Build (lokal via `expo run` oder via EAS Build).

## Was alles drin ist

### Sicherheit & Auth
- **F-001** Vault-Login mit PIN (≥4 Stellen, lokal gehasht)
- **F-002** Biometrischer Login (Face ID / Touch ID via `expo-local-authentication`)
- Tresor lässt sich aus den Einstellungen jederzeit sperren

### Kern-Buchhaltung
- **F-006** Monats-Slider (12 zurück + 12 voraus)
- **F-015** Objekt-Management mit Cascade-Delete
- **F-016** Farbcodierung pro Objekt (8 Farben durchgängig)
- **F-017** Emoji-Kategorien (13 Kategorien, Fixkosten markiert)
- **F-018** Buchung erfassen mit Pattern-Recognition für Wiederkehrend-Vorschlag
- **F-019** Schnellerfassung (Floating Action Button) mit KI-Vorschlag
- **F-020** Mini-Taschenrechner im Betragsfeld
- **F-021** Smarte Empfänger-Autovervollständigung
- **F-022** Vorlagen-System mit 1-Tipp-Buchung
- **F-023** Wiederkehrende Auto-Buchungen beim App-Start
- **F-024** Regeln-Engine (WENN/DANN)
- **F-025** Clipboard-Erkennung beim App-Start (Betrag + IBAN)
- **F-026** Duplikat-Warnung beim Speichern

### KI-Beleg-Autopilot (lokal!)
- **F-027** Multi-Format-Upload: Foto (Galerie + Kamera), PDF, Word, Text
- **F-028** Lokaler Parser für Betrag/Datum/Empfänger/Kategorie aus Dateiname + Text
  - Erkennt deutsche Anbieter (Telekom, GEZ, Stadtwerke, Allianz, …)
  - Erkennt Datumsformate (DD.MM.YYYY, YYYY-MM-DD, "Mai 2026")
  - Confidence-Score pro Beleg
- **F-029** Auto-Eintrag mit 4-Sekunden-Countdown bei hoher Confidence
- **F-030** Multi-Beleg-Upload (alle gewählten Dateien werden nacheinander verarbeitet)
- **F-031** EPC-QR-Code-Scanner für deutsche Rechnungs-Girocodes
- Belege werden im `documentDirectory` lokal gespeichert; Detail-Seite mit Vorschau,
  Teilen-Funktion und Löschen

> **Echte OCR aus Bildern und PDFs** ist als Hook-Punkt vorgesehen (`readExtractableText`
> in `src/lib/storage.ts`). Wer ML Kit anschließen möchte, kann hier einsteigen.
> Aktuell extrahieren wir Text nur aus reinem `.txt`; bei Bildern/PDFs greift der
> Filename-Parser, plus manuelle Bestätigung.

### Tresore
- **F-032** Miet-Tresor — gruppiert Mieteinnahmen nach Mieter, markiert ausstehende Zahlungen
- **F-033** Fixkosten-Tresor — gruppiert Ausgaben nach Kategorie, mit Vergleich zum Vormonat
- Beleg-Tresor + Dokumenten-Tresor mit Tabs

### Verwaltung
- **F-035** Mieter-Profile (Name, Kontakt, Konditionen, Vertrag, Notizen, Status)
  mit One-Touch-Anruf und letzten Mietzahlungen
- **F-036** Handwerker-Zentrale mit Direktruf, E-Mail, Website
- **F-043** Dokumenten-Tresor (Mietvertrag, Versicherung, Grundbuchauszug, …) mit Ablaufdatum
- **F-046** Zählerstand-Tracker (Strom, Gas, Wasser, Heizung) mit Foto-Beweis
- Vorlagen + Regeln direkt im Verwaltungs-Tab

### Analyse
- **F-034** KI-Orakel — Spartipps regelbasiert (Kleinausgaben, Impulskäufe, Marge)
- **F-037** Jahres-Checkup mit 12-Monats-Bar-Chart, KPIs, Top-Kategorien
- **F-038** Vorhersage-Modul (basis) — kombiniert Templates + Durchschnitt der 6 Vormonate

### Globale Suche
- **F-008** Volltext-Suche über Buchungen, Objekte, Mieter, Handwerker, Belege, Dokumente

### Einstellungen
- **F-014** Schriftgröße (Normal / Groß / Sehr Groß) — Wert wird gespeichert,
  globale Anwendung folgt in Phase 3
- **F-051** Haptisches Feedback + Sound-Toggle (Sound: Hook für Asset-basierte Töne)

## Tabs

1. **🏛️ Hauptsaal (Dashboard)** — Bilanz, Orakel-Tipps, Imperien, Quick-Actions, Floating-+-Button
2. **🎰 Buchungen** — Liste + Filter (Typ, Objekt) + Monat
3. **🪙 Tresore** — Miet- / Fixkosten-Tresor / Belege / Dokumente
4. **👥 Verwaltung** — Mieter / Handwerker / Vorlagen / Regeln / Zählerstand
5. **⚙️ Einstellungen** — PIN, Biometrie, Schriftgröße, Haptik, Sound

## Ordnerstruktur

```
mobile/
├── app/                          Expo-Router-Routen
│   ├── _layout.tsx               Root + Auth-Wrapper
│   ├── login.tsx                 PIN + Biometrie
│   ├── (tabs)/                   Bottom-Tab-Routen
│   ├── booking/                  Neue Buchung + Schnellerfassung
│   ├── object/                   Objekt CRUD
│   ├── tenant/                   Mieter CRUD
│   ├── craftsman/                Handwerker CRUD
│   ├── receipt/                  Beleg scannen / QR / Detail
│   ├── document/                 Dokument hochladen
│   ├── reading/                  Zählerstand
│   ├── template/, rule/          Vorlage / Regel
│   ├── oracle.tsx, search.tsx, year.tsx
└── src/
    ├── theme/                    Farben + Typografie + Tokens
    ├── components/               UI-Komponenten (CasinoButton, BarChart, …)
    ├── store/                    Zustand-Store mit Persist (alle Entitäten)
    ├── lib/                      calc · dates · rules · recurring · duplicates ·
    │                             clipboard · parseReceipt · oracle · forecast ·
    │                             search · pin · feedback · storage · tresore · id
    └── types.ts                  Domain-Modelle
```

## Roadmap (was noch fehlt)

Bewusst zurückgestellt, weil Aufwand vs. Nutzen oder externe Abhängigkeiten:

- **F-003** Multi-User mit Rollenmodell (braucht Server-Auth oder Sync)
- **F-004** Cloud-Backups (braucht Backend-Storage)
- **F-005** Drag & Drop Dashboard (komplexes Reorder-UI)
- **F-007** echtes Bottom-Sheet (`@gorhom/bottom-sheet`)
- **F-009** Swipe-Gesten auf Listen (Reanimated-Setup)
- **F-010** Onboarding-Assistent (Spotlight-Tutorial)
- **F-011** Kontextuelle Hilfe-Tooltips
- **F-012** Home-Screen Widget (native Android/iOS Code)
- **F-013** Tab-Memory mit Scroll-Position
- **F-039** PDF-Monatsreport (über `expo-print` möglich, aber Layout-Arbeit)
- **F-040** NK-Abrechnungs-Generator (umfangreiche Geschäftslogik)
- **F-041/042** Steuerreport + DATEV-Export (Pflicht-Felder, Validierung)
- **F-044** Übergabeprotokoll (Foto-Wizard pro Raum)
- **F-045** Leerstand-Tracker (basiert auf Vertragslogik in F-035)
- **F-047** Sprachdiktat (`expo-speech-recognition` ist beta)
- **F-048/049** Push-Benachrichtigungen (braucht Notification-Server)
- **F-050** Geteilte Notizen (braucht F-003 Multi-User)
- **F-051** Casino-Sound-Engine (Asset-Bundling für synthetisierte Töne)

## Daten-Persistenz

Alles liegt in `AsyncStorage` (`manu-imperial-store-v2`). Belege, Dokumente und
Zähler-Fotos liegen als echte Dateien im `FileSystem.documentDirectory`. Beim
Löschen wird die Datei mitentfernt. Migration auf SQLite wird ab ~10k Buchungen
oder bei aktiver Volltextsuche über Datei-Inhalte sinnvoll.
