"""Definition des SQLite-Schemas und der vordefinierten Stammdaten.

Dieses Modul enthält ausschließlich Daten (SQL-Texte und Seed-Listen),
keine Logik. Das eigentliche Anlegen übernimmt ``src/db/init.py``.

Hinweise zu den Spaltentypen:
* Beträge werden als TEXT gespeichert, damit sie verlustfrei als
  ``Decimal`` zurückgelesen werden können (keine float-Rundungsfehler).
* Datumswerte werden als TEXT im ISO-Format ``YYYY-MM-DD`` gespeichert.
"""

from __future__ import annotations

# Versionsnummer des Schemas. Wird in app_settings hinterlegt, damit
# spätere Phasen kontrollierte Migrationen durchführen können.
SCHEMA_VERSION = 6

# Spalten, die in späteren Versionen ergänzt wurden. Werden beim Start
# per ALTER TABLE nachgerüstet, falls sie in einer Alt-Datenbank fehlen.
NACHRUEST_SPALTEN: list[tuple[str, str, str]] = [
    ("objekte", "umlageschluessel", "TEXT NOT NULL DEFAULT 'flaeche'"),
    ("mieter", "wohnflaeche", "TEXT NOT NULL DEFAULT '0'"),
    ("mieter", "personenzahl", "INTEGER NOT NULL DEFAULT 1"),
    ("kategorien", "umlagefaehig", "INTEGER NOT NULL DEFAULT 0"),
    ("buchungen", "mieter_id", "INTEGER REFERENCES mieter(id)"),
    ("buchungsmuster", "mieter_id", "INTEGER REFERENCES mieter(id)"),
    # Straßen-/Erkennungstext je Haus für die automatische Haus-Erkennung
    # aus dem Verwendungszweck (z. B. "Sudstrase" -> Südstraße).
    ("objekte", "erkennungstext", "TEXT"),
]

# --- Tabellendefinitionen -------------------------------------------------

TABELLEN: list[str] = [
    # Häuser / Objekte
    """
    CREATE TABLE IF NOT EXISTS objekte (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL UNIQUE,
        aktiv           INTEGER NOT NULL DEFAULT 1,
        umlageschluessel TEXT   NOT NULL DEFAULT 'flaeche'
    )
    """,
    # Mieter (gehören zu genau einem Objekt)
    """
    CREATE TABLE IF NOT EXISTS mieter (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        objekt_id   INTEGER NOT NULL REFERENCES objekte(id),
        name        TEXT    NOT NULL,
        kaltmiete   TEXT    NOT NULL DEFAULT '0',
        nebenkosten TEXT    NOT NULL DEFAULT '0',
        ruecklage   TEXT    NOT NULL DEFAULT '0',
        aktiv_von   TEXT,
        aktiv_bis   TEXT,
        wohnflaeche TEXT    NOT NULL DEFAULT '0',
        personenzahl INTEGER NOT NULL DEFAULT 1
    )
    """,
    # Buchungskategorien, getrennt nach Ausgabe und Einnahme
    """
    CREATE TABLE IF NOT EXISTS kategorien (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        typ          TEXT    NOT NULL CHECK (typ IN ('ausgabe', 'einnahme')),
        aktiv        INTEGER NOT NULL DEFAULT 1,
        umlagefaehig INTEGER NOT NULL DEFAULT 0,
        UNIQUE (name, typ)
    )
    """,
    # Einzelbuchungen
    """
    CREATE TABLE IF NOT EXISTS buchungen (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        datum        TEXT    NOT NULL,
        betrag       TEXT    NOT NULL,
        objekt_id    INTEGER REFERENCES objekte(id),
        kategorie_id INTEGER REFERENCES kategorien(id),
        mieter_id    INTEGER REFERENCES mieter(id),
        beschreibung TEXT,
        beleg_pfad   TEXT,
        quelle       TEXT
    )
    """,
    # Lernsystem: erkannte Empfängertexte mit Zuordnung
    """
    CREATE TABLE IF NOT EXISTS buchungsmuster (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        erkennungstext TEXT   NOT NULL,
        objekt_id     INTEGER REFERENCES objekte(id),
        kategorie_id  INTEGER REFERENCES kategorien(id),
        bestaetigt_am TEXT
    )
    """,
    # Erfasste Mietzahlungen
    """
    CREATE TABLE IF NOT EXISTS mietzahlungen (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        mieter_id     INTEGER NOT NULL REFERENCES mieter(id),
        monat         INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
        jahr          INTEGER NOT NULL,
        betrag        TEXT    NOT NULL,
        datum_eingang TEXT,
        UNIQUE (mieter_id, monat, jahr)
    )
    """,
    # Allgemeine Einstellungen als Schlüssel-Wert-Speicher
    """
    CREATE TABLE IF NOT EXISTS app_settings (
        schluessel TEXT PRIMARY KEY,
        wert       TEXT
    )
    """,
    # Benutzerdefinierte Regeln für die Auto-Zuordnung. Eine Regel
    # gewinnt vor dem gelernten Muster und kann Haus, Kategorie und
    # Mieter unabhängig voneinander vorgeben.
    """
    CREATE TABLE IF NOT EXISTS regeln (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        muster       TEXT    NOT NULL,
        objekt_id    INTEGER REFERENCES objekte(id),
        kategorie_id INTEGER REFERENCES kategorien(id),
        mieter_id    INTEGER REFERENCES mieter(id),
        aktiv        INTEGER NOT NULL DEFAULT 1
    )
    """,
    # Investitionen je Haus: Erhaltungsaufwand (sofort absetzbar) oder
    # Herstellungsaufwand (über Nutzungsdauer abgeschrieben, AfA).
    """
    CREATE TABLE IF NOT EXISTS investitionen (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        objekt_id       INTEGER NOT NULL REFERENCES objekte(id),
        datum           TEXT    NOT NULL,
        betrag          TEXT    NOT NULL,
        beschreibung    TEXT,
        typ             TEXT    NOT NULL CHECK (typ IN ('erhaltung','herstellung')),
        nutzungsdauer   INTEGER NOT NULL DEFAULT 50,
        beleg_pfad      TEXT
    )
    """,
    # Aktions-Log für die Rückgängig-Funktion. Bewahrt den Zustand
    # *vor* einer rückgängig-machbaren Aktion als JSON auf.
    """
    CREATE TABLE IF NOT EXISTS aktionen (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        zeit          TEXT    NOT NULL,
        art           TEXT    NOT NULL,
        tabelle       TEXT    NOT NULL,
        datensatz_id  INTEGER,
        zustand_alt   TEXT,
        zustand_neu   TEXT,
        zurueckgesetzt INTEGER NOT NULL DEFAULT 0
    )
    """,
    # Volltexte zu archivierten Belegen (digital + ggf. OCR).
    """
    CREATE TABLE IF NOT EXISTS beleg_texte (
        beleg_pfad  TEXT PRIMARY KEY,
        text        TEXT,
        erstellt_am TEXT
    )
    """,
]

# --- Vordefinierte Stammdaten (Seed) -------------------------------------

SEED_OBJEKTE: list[str] = [
    "Annaveenstraße",
    "Finkenstraße",
    "Südstraße",
    "Oberwohnung",
]

SEED_KATEGORIEN_AUSGABE: list[str] = [
    "Versicherung",
    "Schornsteinfeger",
    "Gemeinde/Grundbesitz",
    "Müll",
    "Wasser",
    "Gas",
    "Strom",
    "Vodafone",
    "GEZ",
    "Erbpacht",
    "Kontoabschluss",
    "Finanzamt",
    "Sonstiges",
]

SEED_KATEGORIEN_EINNAHME: list[str] = [
    "Kaltmiete",
    "Nebenkosten",
    "Rücklage",
]
