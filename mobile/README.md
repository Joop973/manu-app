# Manu Imperial Finance — Mobile (Expo / React Native)

Native iOS/Android-App im Caesars-Palace-Look mit Buchhaltung, KI-Beleg-Autopilot,
Tresoren, Mieter-/Handwerker-Verwaltung, Net-Worth-Tracking, Sparzielen, Budgets,
Subscription-Detector, Vertragsmanager und mehr — alles **lokal**, ohne Cloud.

## Stack

- Expo SDK 52 + Expo Router (file-based)
- TypeScript (strict)
- Zustand + AsyncStorage
- expo-file-system, expo-camera, expo-image-picker, expo-document-picker
- expo-local-authentication (Face ID / Touch ID)
- expo-notifications (lokale Reminder)
- expo-print + expo-sharing (PDF / CSV)
- Cinzel + Cormorant Garamond + Lato (Google Fonts)

## Setup

```bash
cd mobile
npm install
npx expo prebuild
npx expo run:ios       # oder run:android
```

> Läuft NICHT in Expo Go (wegen `expo-camera` + `expo-local-authentication` +
> `expo-notifications`). Development-Build via `expo prebuild` ist nötig.

## Implementierte Features (3 Phasen)

### Sicherheit & Auth
- **F-001** PIN-Login (lokal gehasht)
- **F-002** Face ID / Touch ID
- Tresor jederzeit per Settings sperrbar

### Kern-Buchhaltung
- **F-006** Monats-Slider · **F-008** Globale Suche · **F-014** Schriftgröße
- **F-015** Objekt-Management mit Cascade-Delete
- **F-016** Farbcodierung pro Objekt · **F-017** Emoji-Kategorien
- **F-018** Buchung mit Pattern-Recognition · **F-019** Schnellerfassung (FAB)
- **F-020** Mini-Taschenrechner · **F-021** Empfänger-Autocomplete
- **F-022** Vorlagen · **F-023** Auto-Buchungen · **F-024** Regeln-Engine
- **F-025** Clipboard-Erkennung · **F-026** Duplikat-Warnung

### KI-Beleg-Autopilot (lokal)
- **F-027** Multi-Format-Upload · **F-028** Lokaler Parser · **F-029** Auto-Eintrag
- **F-030** Multi-Beleg · **F-031** EPC-QR-Scanner

### Tresore + Verwaltung
- **F-032** Miet-Tresor · **F-033** Fixkosten-Tresor · **F-034** KI-Orakel
- **F-035** Mieter · **F-036** Handwerker · **F-043** Dokumenten-Tresor
- **F-046** Zählerstand-Tracker · **F-051** Haptik + Sound

### Phase 3 — Erweitertes Feature-Set

| F-Nr | Feature | Quelle |
|------|---------|--------|
| **F-100** | Tags / Multi-Labels an Buchungen | Outbank |
| **F-101** | Subscription Detector aus Buchungshistorie | Rocket Money |
| **F-102** | Property-by-Property P&L (1/3/12 Mt) | Stessa |
| **F-103** | Tenant Payment Timeline (12-Mt Bar) | Stessa |
| **F-104** | Calendar-Heatmap GitHub-Style | Eigene Idee |
| **F-105** | Leftover Daily-Spend | PocketGuard |
| **F-106** | Cash-Flow-Projection | Monarch |
| **F-107** | Lokale Notifications für Verträge etc. | Mint |
| **F-108** | Vertrags-Tracker mit Kündigungsfrist | Finanzguru |
| **F-109** | Sparziele mit Fortschritt | Monarch |
| **F-110** | Utility Meter Trending mit Anomalie | Stessa |
| **F-111** | Custom Reports (PDF + CSV) | Mint |
| **F-112** | Net Worth (Aktiva − Passiva) | Empower |
| **F-113** | Envelope Budgeting + adaptive Vorschläge | YNAB |
| **F-114** | CSV-Import (DKB, Sparkasse, ING, N26 …) | Outbank |
| **F-115** | Investment-Portfolio (manuell) | Empower |
| **F-116** | Adaptive Budget-Vorschläge | Copilot |
| **F-117** | Debt-Payoff-Planner mit Zinslast | PocketGuard |
| **F-118** | Achievements / Streaks | Casino-Theme |
| **F-119** | Was-wäre-wenn-Slider | Eigene Idee |
| **F-120** | Maintenance-Historie pro Objekt | Stessa |
| **F-121** | Brutto/Netto-Rechner + Pauschalbeträge DE | Eigene Idee |
| **F-122** | Bill-Splitting | Splitwise |
| **F-123** | AI-Analyst regelbasiert (Q&A im Orakel) | Monarch-Light |
| **F-124** | Rent-Mailto-Reminder im Mieter-Detail | Stessa |

## Tabs

1. **🏛 Hauptsaal** — Bilanz, Leftover-Card, Heatmap, Orakel, Goals, Quick-Actions, Achievements, Property-Cards
2. **🎰 Buchungen** — Liste + Filter
3. **🪙 Tresore** — Miete / Fixkosten / Belege / Dokumente / Finanzen (Net Worth, Investments, Goals, Abos, Verträge, Budgets, Tilgung, Splits)
4. **👥 Verwaltung** — Mieter / Handwerker / Vorlagen / Regeln / Zähler / Tags / Tools
5. **⚙ Einstellungen** — PIN, Biometrie, Notifications, Schriftgröße, Haptik, Sound, Tools-Verlinkung

## Ordnerstruktur

```
mobile/
├── app/
│   ├── _layout.tsx · login.tsx
│   ├── (tabs)/                     Dashboard, Buchungen, Tresore, Admin, Settings
│   ├── booking/, object/, tenant/, craftsman/, receipt/, document/, reading/
│   ├── template/, rule/, tag/      Anlage-Modale
│   ├── maintenance/                F-120
│   ├── subscriptions.tsx           F-101
│   ├── contracts.tsx               F-108
│   ├── goals.tsx                   F-109
│   ├── networth.tsx                F-112
│   ├── budgets.tsx                 F-113 + F-116
│   ├── investments.tsx             F-115
│   ├── debt.tsx                    F-117
│   ├── splits.tsx                  F-122
│   ├── whatif.tsx                  F-119
│   ├── brutto-netto.tsx            F-121
│   ├── csv-import.tsx              F-114
│   ├── reports.tsx                 F-111
│   ├── oracle.tsx                  F-034 + F-123
│   ├── search.tsx · year.tsx
└── src/
    ├── theme/                      Farben, Tokens, Typografie
    ├── components/                 CasinoButton, BarChart, HeatmapCalendar, AchievementsCard, etc.
    ├── store/useAppStore.ts        Zentrale Zustand-Logik
    ├── lib/                        analyst, achievements, budgets, calc, cashflow, csvImport,
    │                               debt, dates, duplicates, forecast, goals, heatmap, id,
    │                               networth, notifications, oracle, parseReceipt, pin,
    │                               propertyAnalytics, recurring, reports, rules, search,
    │                               storage, subscriptions, tresore, whatif, bruttoNetto, feedback
    └── types.ts                    Domain-Modelle
```

## Daten-Persistenz

Alles in `AsyncStorage` (`manu-imperial-store-v3`). Belege, Dokumente und Zähler-Fotos
liegen als reale Dateien im `FileSystem.documentDirectory`. Migration auf SQLite
sinnvoll ab ~10k Buchungen oder bei aktiver Volltextsuche über Datei-Inhalte.

## Roadmap (bewusst zurückgestellt)

Brauchen Backend / native Module / komplexe Drittanbieter-Logik:

- **F-003** Multi-User mit Rollen (Server-Auth)
- **F-004** Cloud-Backup (Server-Storage; Workaround: Export zu iCloud/Drive via Share)
- **F-005** Drag-and-drop-Dashboard
- **F-007** Echtes Bottom-Sheet (`@gorhom/bottom-sheet`)
- **F-009** Swipe-Gesten auf Listen
- **F-010** Onboarding-Tutorial
- **F-011** Kontextuelle Hilfe-Tooltips
- **F-012** Home-Screen Widgets (nativer Code)
- **F-013** Tab-Memory mit Scroll-Position
- **F-039 / F-040 / F-041 / F-042** Monatsreport-Mail / NK-Abrechnung / Anlage V / DATEV-Export (Geschäftslogik + Pflichtfelder)
- **F-044** Übergabeprotokoll-Wizard (Foto pro Raum)
- **F-045** Leerstandstracker (basiert auf F-035)
- **F-047** Sprachdiktat
- **F-048 / F-049** Push-Notifications mit Server
- **F-050** Geteilte Notizen (braucht F-003)

Alle Backend-Features mit lokaler Alternative bereits eingebaut:
- Bank-Sync → **CSV-Import** (F-114)
- Bill Negotiation → **Vertragsalter-Warnung** (F-108 mit Reminder via F-107)
- Online Rent Collection → **Mailto-Reminder** (F-124)
- Push-Server → **Lokale Notifications** (F-107)
- AI-Chat-Assistent → **Regelbasierter Orakel-Q&A** (F-123)
