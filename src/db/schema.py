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
SCHEMA_VERSION = 10

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
    # Manuelles Umlage-Gewicht je Mieter (überschreibt den automatischen
    # Schlüssel in der Nebenkostenabrechnung). NULL = automatisch.
    ("mieter", "umlage_gewicht", "TEXT"),
    # --- Schema 10: steuerliche Behandlung -------------------------------
    # Steuerliche Art der Kategorie (Schlüssel aus src/logic/steuer.py,
    # z. B. "miete", "wk_laufend", "privat"). NULL = noch nicht geklärt.
    ("kategorien", "steuer_art", "TEXT"),
    # Voreinstellung: welcher Anteil (Prozent) steuerlich angesetzt wird.
    ("kategorien", "steuer_prozent", "TEXT NOT NULL DEFAULT '100'"),
    # Feste Rolle für die Mietlogik ("kaltmiete", "nebenkosten",
    # "ruecklage"), damit Kategorien frei umbenannt werden können.
    ("kategorien", "rolle", "TEXT"),
    # Sachkonto für den DATEV-Export (leer = Vorgabe je steuerlicher Art).
    ("kategorien", "datev_konto", "TEXT"),
    # Abweichender steuerlicher Anteil nur für diese Buchung (NULL =
    # Voreinstellung von Haus/Kategorie).
    ("buchungen", "steuer_prozent", "TEXT"),
    # Abweichendes Steuerjahr (§ 11 EStG, 10-Tage-Regel). NULL = Jahr
    # des Buchungsdatums.
    ("buchungen", "steuerjahr", "INTEGER"),
    # Stammdaten je Haus für Anlage V, AfA, Nebenkosten und DATEV.
    ("objekte", "adresse", "TEXT"),
    ("objekte", "gesamtflaeche", "TEXT"),
    ("objekte", "afa_bemessung", "TEXT"),
    ("objekte", "afa_beginn", "TEXT"),
    ("objekte", "afa_satz", "TEXT"),
    ("objekte", "kostenstelle", "TEXT"),
    # Verteilung größeren Erhaltungsaufwands auf 1–5 Jahre (§ 82b EStDV).
    ("investitionen", "verteilung_jahre", "INTEGER NOT NULL DEFAULT 1"),
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
    # Gedächtnis bereits importierter Kontoauszüge (Dubletten-Schutz).
    # Kennung ist z. B. "324779100|3/2026".
    """
    CREATE TABLE IF NOT EXISTS importierte_auszuege (
        kennung       TEXT PRIMARY KEY,
        dateiname     TEXT,
        importiert_am TEXT
    )
    """,
    # Zuordnung Bankkonto -> Standard-Haus. ``kennung`` wird als Endung
    # der Kontonummer im Auszug abgeglichen (z. B. "100"). ``objekt_id``
    # NULL bedeutet: Konto bekannt, aber kein pauschales Standard-Haus
    # (Erkennung entscheidet, Unklares bleibt zur Kontrolle).
    """
    CREATE TABLE IF NOT EXISTS konten (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        kennung   TEXT    NOT NULL UNIQUE,
        name      TEXT,
        objekt_id INTEGER REFERENCES objekte(id)
    )
    """,
    # Abweichender steuerlicher Anteil einer Kategorie für ein bestimmtes
    # Haus (überschreibt die Voreinstellung der Kategorie).
    """
    CREATE TABLE IF NOT EXISTS kategorie_haus_anteil (
        objekt_id    INTEGER NOT NULL REFERENCES objekte(id),
        kategorie_id INTEGER NOT NULL REFERENCES kategorien(id),
        prozent      TEXT    NOT NULL,
        PRIMARY KEY (objekt_id, kategorie_id)
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

# Vordefinierte Kategorien: (Name, Typ, steuerliche Art, Rolle).
# Die steuerliche Art steuert, wo die Kategorie in der Anlage V landet
# (siehe src/logic/steuer.py). ``None`` = noch zu klären.
SEED_KATEGORIEN: list[tuple[str, str, str | None, str | None]] = [
    ("Versicherung (Gebäude/Haftpflicht)", "ausgabe", "wk_laufend", None),
    ("Schornsteinfeger", "ausgabe", "wk_laufend", None),
    ("Grundsteuer/Gemeindeabgaben", "ausgabe", "wk_laufend", None),
    ("Müllabfuhr", "ausgabe", "wk_laufend", None),
    ("Wasser/Abwasser", "ausgabe", "wk_laufend", None),
    ("Heizung/Gas", "ausgabe", "wk_laufend", None),
    ("Strom", "ausgabe", "wk_laufend", None),
    ("Internet/Telefon für Mieter", "ausgabe", "wk_laufend", None),
    ("Rundfunkbeitrag (GEZ) für Mieter", "ausgabe", "wk_laufend", None),
    ("Erbpacht/Erbbauzins", "ausgabe", "wk_laufend", None),
    ("Kontoführung/Bankgebühren", "ausgabe", "wk_laufend", None),
    ("Reparaturen/Instandhaltung", "ausgabe", "wk_erhaltung", None),
    ("Modernisierung/Anschaffung (AfA)", "ausgabe", "herstellung", None),
    ("Sonstige Werbungskosten (Fahrten, Porto, Beratung)", "ausgabe",
     "wk_sonstige", None),
    ("Einkommensteuer/Finanzamt (privat)", "ausgabe", "privat", None),
    ("Sonstiges", "ausgabe", None, None),
    ("Kaltmiete", "einnahme", "miete", "kaltmiete"),
    ("Nebenkosten-Vorauszahlung", "einnahme", "umlagen", "nebenkosten"),
    ("Rücklage (Umbuchung eigenes Geld)", "einnahme", "neutral",
     "ruecklage"),
    ("Mietkaution", "einnahme", "neutral", None),
]

# Umstellung bestehender Datenbanken (Schema 10): alte Seed-Namen
# bekommen verständliche Namen und eine steuerliche Art. Nur Kategorien,
# die noch exakt den alten Namen tragen, werden umbenannt.
# (alter Name, Typ) -> (neuer Name, steuerliche Art, Rolle)
KATEGORIE_UMSTELLUNG_V10: dict[tuple[str, str], tuple[str, str | None, str | None]] = {
    ("Versicherung", "ausgabe"):
        ("Versicherung (Gebäude/Haftpflicht)", "wk_laufend", None),
    ("Schornsteinfeger", "ausgabe"): ("Schornsteinfeger", "wk_laufend", None),
    ("Gemeinde/Grundbesitz", "ausgabe"):
        ("Grundsteuer/Gemeindeabgaben", "wk_laufend", None),
    ("Müll", "ausgabe"): ("Müllabfuhr", "wk_laufend", None),
    ("Wasser", "ausgabe"): ("Wasser/Abwasser", "wk_laufend", None),
    ("Gas", "ausgabe"): ("Heizung/Gas", "wk_laufend", None),
    ("Strom", "ausgabe"): ("Strom", "wk_laufend", None),
    ("Vodafone", "ausgabe"): ("Internet/Telefon für Mieter", "wk_laufend", None),
    ("GEZ", "ausgabe"):
        ("Rundfunkbeitrag (GEZ) für Mieter", "wk_laufend", None),
    ("Erbpacht", "ausgabe"): ("Erbpacht/Erbbauzins", "wk_laufend", None),
    ("Kontoabschluss", "ausgabe"):
        ("Kontoführung/Bankgebühren", "wk_laufend", None),
    ("Finanzamt", "ausgabe"):
        ("Einkommensteuer/Finanzamt (privat)", "privat", None),
    ("Kaltmiete", "einnahme"): ("Kaltmiete", "miete", "kaltmiete"),
    ("Nebenkosten", "einnahme"):
        ("Nebenkosten-Vorauszahlung", "umlagen", "nebenkosten"),
    ("Rücklage", "einnahme"):
        ("Rücklage (Umbuchung eigenes Geld)", "neutral", "ruecklage"),
}

# Frühere Namen je aktuellem Namen — damit Stichwort-Heuristik und
# Altdaten auch dann greifen, wenn die Umbenennung (z. B. wegen einer
# Namenskollision) nicht stattfinden konnte.
KATEGORIE_ALTNAMEN: dict[str, str] = {
    neu: alt for (alt, _typ), (neu, _art, _rolle)
    in KATEGORIE_UMSTELLUNG_V10.items() if neu != alt
}

# Vordefinierte Konto-Zuordnung: (Endung der Kontonummer, Anzeigename,
# Standard-Haus-Name oder None). None = mehrere Häuser teilen das Konto,
# daher kein pauschales Standard-Haus.
SEED_KONTEN: list[tuple[str, str, str | None]] = [
    ("100", "Konto Südstraße (…100)", "Südstraße"),
    ("300", "Konto Annaveen/Finken/Oberwohnung (…300)", None),
]
