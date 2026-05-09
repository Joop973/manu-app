# Manu Imperial Finance — Mobile (Expo / React Native)

Native iOS/Android-App im Caesars-Palace-Look mit Fokus auf Buchhaltung, Belege und KI-Unterstützung.

Status: **Phase 1 — Fundament + Kern-Buchhaltung**.

## Stack

- Expo SDK 52 + Expo Router (file-based)
- TypeScript (strict)
- Zustand + AsyncStorage (persistente Speicherung)
- Expo Google Fonts: Cinzel, Cormorant Garamond, Lato

## Setup

```bash
cd mobile
npm install
npx expo start
```

Dann im Terminal `i` (iOS Simulator), `a` (Android Emulator) oder QR-Code mit Expo Go scannen.

## Was bereits drin ist

### Fundament
- Caesars-Palace-Theme (Royal Blue + Imperial Gold, Cinzel-Headlines)
- Casino-Chip-Buttons mit 3D-Schatten und Press-Animation
- Bottom-Tab-Navigation (Dashboard, Buchungen, Regeln, Vorlagen)
- Modal-Routen für Anlage-Formulare
- Persistente Datenhaltung via AsyncStorage

### Implementierte Features (aus Spec v1.0)
- **F-006** Monats-Slider (12 Monate zurück + 12 voraus, mit Pfeilen + Chip-Track)
- **F-015** Dynamisches Objekt-Management (anlegen, bearbeiten, löschen mit Cascade)
- **F-016** Farbcodierung pro Objekt (8 Farben, durchgängig in Karten + Filter)
- **F-017** Emoji-Kategorien (13 vordefinierte Kategorien, eigene erweiterbar)
- **F-018** Buchung erfassen mit Typ-Toggle, Pattern-Recognition für Wiederkehrend-Vorschlag
- **F-019** Schnellerfassung mit KI-Vorschlag (Kategorie + Objekt anhand Historie)
- **F-020** Taschenrechner im Betragsfeld (`1200-85,50` → `1.114,50 €` Live-Vorschau)
- **F-021** Smarte Autovervollständigung der Empfänger
- **F-022** Vorlagen-System mit 1-Tipp-Buchung
- **F-023** Wiederkehrende Auto-Buchungen (werden beim App-Start verbucht, Stichtag-basiert)
- **F-024** Regeln-Engine (WENN Empfänger/Notiz/Betrag → DANN Kategorie/Objekt/Wiederkehrung)
- **F-025** Clipboard-Erkennung beim App-Start (Betrag + IBAN)
- **F-026** Duplikat-Warnung beim Speichern

### Noch nicht drin (Roadmap)
- F-001/002/003 Vault-Login + Biometrie + Multi-User
- F-007 echtes Bottom-Sheet (aktuell Modal-Stack)
- F-027–031 KI-Beleg-Autopilot (PDF-Upload, OCR, Multi-Beleg, QR)
- F-032/033 Tresore (Miet- + Fixkosten-Tresor)
- F-034 KI-Orakel mit Spartipps
- F-035 Mieter-Profile, F-036 Handwerker, F-037 Jahres-Checkup
- F-039–042 Reports (PDF, NK-Abrechnung, Steuer, DATEV)
- F-043 Dokumenten-Tresor, F-044 Übergabeprotokoll, F-045 Leerstand, F-046 Zähler
- F-047 Sprachdiktat, F-048/049 Push, F-051 Sound-Engine

## Ordnerstruktur

```
mobile/
├── app/                 Expo-Router-Routen
│   ├── _layout.tsx      Root: Fonts, Theme, Auto-Buchungen, Clipboard
│   ├── (tabs)/          Bottom-Tab-Routen
│   ├── booking/         Neue Buchung + Schnellerfassung
│   ├── object/          Objekt anlegen + Detail
│   ├── template/        Vorlage anlegen
│   └── rule/            Regel anlegen
└── src/
    ├── theme/           Farben, Typografie, Tokens
    ├── components/      Casino-Chips, Pickers, Cards, Inputs
    ├── store/           Zustand-Store mit Persist
    ├── lib/             calc, dates, rules, recurring, duplicates, clipboard, id
    └── types.ts         Domain-Modelle
```

## Daten-Schicht

Aktuell AsyncStorage-basiert (Zustand `persist`). Migration auf SQLite + Drizzle ist möglich,
sobald das Datenvolumen wächst (>10k Buchungen) oder Volltext-Indexierung gebraucht wird (F-008/F-043).

Alle Schreib-Pfade laufen zentral durch `useAppStore` — keine Komponente fasst AsyncStorage direkt an.

## Nächster Schritt

KI-Beleg-Autopilot (F-027–F-031): PDF/Foto-Upload, OCR, Auto-Erkennung von Betrag/Datum/Empfänger,
Auto-Eintrag mit 4-Sekunden-Countdown. Braucht eine Backend-Anbindung an ein LLM mit Vision (z.B.
Claude API oder OpenAI Vision) und ein eigenes File-Storage-Konzept.
