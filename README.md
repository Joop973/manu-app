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

## .exe erstellen (Build)

Die App lässt sich mit PyInstaller zu einer eigenständigen Windows-.exe
packen. Der Build muss **auf einem Windows-Rechner** ausgeführt werden:

```bash
pip install -r requirements.txt
pyinstaller --onefile --windowed --name ManuApp manu.py
```

Die fertige Datei liegt anschließend unter `dist/ManuApp.exe`. Sie kann
in einen beliebigen Ordner kopiert werden; Datenbank, Belege und
Exporte werden beim Start daneben angelegt.

Hinweise:

* `--onefile` erzeugt eine einzelne Datei, `--windowed` unterdrückt das
  Konsolenfenster.
* Beim ersten Start kann eine Antiviren-Prüfung den Start verzögern.
* Datenbank und Belege sollten regelmäßig gesichert werden — die App
  erstellt dazu beim Schließen automatisch ein Backup.

## Bedienung (Kurzanleitung)

* **Anmeldung:** Beim ersten Start PIN festlegen, danach PIN eingeben.
* **Dashboard:** Jahres- und Monatsübersicht je Haus.
* **Buchungen:** Buchungen erfassen, filtern, Belege anhängen/öffnen.
* **Mieter:** Monats-Checkliste — Häkchen erfasst die Mietzahlung.
* **Import:** Kontoauszug-PDF einlesen, Buchungen in der Vorschau prüfen
  und übernehmen; Belege archivieren.
* **Stammdaten:** Häuser, Mieter, Kategorien und gelernte Muster pflegen.
* **Export:** Excel-Jahresübersicht erstellen.
* **Einstellungen:** PIN ändern, Backup-Ordner wählen, manuell sichern.

## Projektstruktur

```
ManuApp/
├── manu.py                  Einstiegspunkt
├── requirements.txt         Abhängigkeiten
├── README.md
├── controlling.db           SQLite-Datenbank (wird beim ersten Start erzeugt)
├── sicherungen/             datierte Datenbank-Sicherungen (Auto-Backup)
├── belege/                  archivierte Belege
├── belege_backup/           gespiegelte Belege (Auto-Backup)
├── exports/                 Excel-Exporte
└── src/
    ├── db/                   Datenbank-Layer
    │   ├── schema.py         Tabellendefinitionen und Seed-Daten
    │   ├── database.py       Verbindungsaufbau (WAL-Modus)
    │   ├── init.py           Initialisierung und Stammdaten-Seed
    │   ├── stammdaten.py     Datenzugriff für Häuser/Mieter/Kategorien
    │   ├── buchungen.py      Datenzugriff für Buchungen + Jahres-Auswertung
    │   ├── mietzahlungen.py  Mietzahlungen erfassen/zurücknehmen
    │   ├── muster.py         Datenzugriff für das Lernsystem
    │   └── einstellungen.py  Zugriff auf die Einstellungstabelle
    ├── ui/                   PySide6-Fenster und -Dialoge
    │   ├── login_dialog.py       PIN festlegen / Anmeldung (mit Sperre)
    │   ├── main_window.py        Hauptfenster mit Navigation
    │   ├── tabelle.py            gemeinsame Tabellen-Helfer (Sortierung)
    │   ├── dashboard_seite.py    Jahresübersicht je Haus
    │   ├── buchungen_seite.py    Buchungserfassung mit Filtern
    │   ├── mieter_seite.py       Monats-Checkliste der Mietzahlungen
    │   ├── import_seite.py       PDF-Import und Beleg-Archivierung
    │   ├── stammdaten_seite.py   Stammdatenverwaltung (vier Reiter)
    │   ├── export_seite.py       Excel-Export
    │   └── einstellungen_seite.py  PIN, Backup, Speicherort
    ├── logic/                Geschäftslogik
    │   ├── belege.py         Archivierung von Belegdateien
    │   ├── pdf_import.py     Auslesen von Kontoauszug-PDFs
    │   ├── lernsystem.py     Normalisierung + automatische Zuordnung
    │   ├── export.py         Excel-Jahresübersicht (openpyxl)
    │   └── backup.py         Datensicherung von Datenbank und Belegen
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
* **Phase 5 — abgeschlossen:** Excel-Export, Auto-Backup, .exe-Build
