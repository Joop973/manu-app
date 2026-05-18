# Manu-App — Hausverwaltung & Controlling

Lokale Windows-Desktop-Anwendung für die private Hausverwaltung einer
Einzelperson. Ersetzt eine bisher manuell gepflegte Excel-Tabelle und
automatisiert das Erfassen von Kontoauszügen.

* **Zielplattform:** Windows 10/11, lokal, vollständig offline
* **Oberfläche:** Deutsch, PIN-geschützt
* **Tech-Stack:** Python 3.11+, PySide6, SQLite, pdfplumber, openpyxl, PyInstaller
* Keine Cloud, keine Online-Dienste, keine externen APIs

## Installation (Entwicklung)

```bash
pip install -r requirements.txt
python manu.py
```

Beim allerersten Start wird die Datenbank `controlling.db` angelegt,
die vordefinierten Stammdaten eingefügt und ein PIN abgefragt.

## Projektstruktur

```
ManuApp/
├── manu.py                  Einstiegspunkt
├── requirements.txt         Abhängigkeiten
├── README.md
├── controlling.db           SQLite-Datenbank (wird beim ersten Start erzeugt)
├── controlling_backup.db    Auto-Backup (ab Phase 5)
├── belege/                  archivierte Belege
├── exports/                 Excel-Exporte
└── src/
    ├── db/                   Datenbank-Layer
    │   ├── schema.py         Tabellendefinitionen und Seed-Daten
    │   ├── database.py       Verbindungsaufbau (WAL-Modus)
    │   ├── init.py           Initialisierung und Stammdaten-Seed
    │   ├── stammdaten.py     Datenzugriff für Häuser/Mieter/Kategorien
    │   ├── buchungen.py      Datenzugriff für Buchungen + Jahres-Auswertung
    │   ├── mietzahlungen.py  Mietzahlungen erfassen/zurücknehmen
    │   └── muster.py         Datenzugriff für das Lernsystem
    ├── ui/                   PySide6-Fenster und -Dialoge
    │   ├── login_dialog.py   PIN festlegen / Anmeldung (mit Sperre)
    │   ├── main_window.py    Hauptfenster mit Navigation
    │   ├── tabelle.py        gemeinsame Tabellen-Helfer (Sortierung)
    │   ├── dashboard_seite.py    Jahresübersicht je Haus
    │   ├── buchungen_seite.py    Buchungserfassung mit Filtern
    │   ├── mieter_seite.py       Monats-Checkliste der Mietzahlungen
    │   ├── import_seite.py       PDF-Import und Beleg-Archivierung
    │   └── stammdaten_seite.py   Stammdatenverwaltung (drei Reiter)
    ├── logic/                Geschäftslogik
    │   ├── belege.py         Archivierung von Belegdateien
    │   ├── pdf_import.py     Auslesen von Kontoauszug-PDFs
    │   └── lernsystem.py     Normalisierung + automatische Zuordnung
    └── utils/                Hilfsfunktionen
        ├── paths.py          zentrale Pfadverwaltung
        ├── security.py       PIN-Hashing (SHA-256 + Salt)
        └── eingaben.py       Betrag parsen/formatieren, Validierung
```

## Entwicklungsstand

* **Phase 1 — abgeschlossen:** Grundgerüst, Datenbank, PIN-Login
* **Phase 2 — abgeschlossen:** Stammdatenverwaltung (Häuser, Mieter, Kategorien)
* **Phase 3 — abgeschlossen:** Buchungserfassung, Mietzahlungen, Dashboard
* **Phase 4 — abgeschlossen:** PDF-Import mit Lernsystem, Beleg-Archivierung
* Phase 4 — PDF-Import mit Lernsystem *(geplant)*
* Phase 5 — Excel-Export, Auto-Backup, .exe-Build *(geplant)*
