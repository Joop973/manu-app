"""Initialisierung der Datenbank.

Beim allerersten Start werden alle Tabellen angelegt und die
vordefinierten Stammdaten (Häuser, Kategorien) eingefügt. Bei späteren
Starts wird nur sichergestellt, dass alle Tabellen vorhanden sind.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path

from src.db import database, schema

# Einstellungsschlüssel für einen einmaligen Hinweis nach einem Update
# (wird beim nächsten Start angezeigt und danach gelöscht).
SCHLUESSEL_UPDATE_HINWEIS = "update_hinweis"


def _tabellen_anlegen(verbindung: sqlite3.Connection) -> None:
    """Legt alle Tabellen an (idempotent durch IF NOT EXISTS)."""
    for tabellen_sql in schema.TABELLEN:
        verbindung.execute(tabellen_sql)


def _stammdaten_einfuegen(verbindung: sqlite3.Connection) -> None:
    """Fügt die vordefinierten Häuser und Kategorien ein.

    Wird nur ausgeführt, wenn die jeweilige Tabelle noch leer ist, damit
    spätere Änderungen des Nutzers nicht überschrieben werden.
    """
    anzahl_objekte = verbindung.execute(
        "SELECT COUNT(*) FROM objekte"
    ).fetchone()[0]
    if anzahl_objekte == 0:
        verbindung.executemany(
            "INSERT INTO objekte (name, aktiv) VALUES (?, 1)",
            [(name,) for name in schema.SEED_OBJEKTE],
        )

    anzahl_kategorien = verbindung.execute(
        "SELECT COUNT(*) FROM kategorien"
    ).fetchone()[0]
    if anzahl_kategorien == 0:
        verbindung.executemany(
            "INSERT INTO kategorien (name, typ, aktiv, steuer_art, rolle) "
            "VALUES (?, ?, 1, ?, ?)",
            schema.SEED_KATEGORIEN,
        )

    _konten_einfuegen(verbindung)


def _konten_einfuegen(verbindung: sqlite3.Connection) -> None:
    """Fügt die vordefinierte Konto-Zuordnung ein (nur wenn Tabelle leer).

    Das Standard-Haus wird über den Hausnamen aufgelöst, damit die
    Zuordnung auch in einer bestehenden Datenbank greift, in der die
    Häuser bereits eigene IDs haben.
    """
    tabellen = {
        z["name"]
        for z in verbindung.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    if "konten" not in tabellen:
        return
    if verbindung.execute("SELECT COUNT(*) FROM konten").fetchone()[0] != 0:
        return
    for kennung, name, haus_name in schema.SEED_KONTEN:
        objekt_id = None
        if haus_name is not None:
            zeile = verbindung.execute(
                "SELECT id FROM objekte WHERE name = ? COLLATE NOCASE",
                (haus_name,),
            ).fetchone()
            if zeile is not None:
                objekt_id = zeile["id"]
        verbindung.execute(
            "INSERT INTO konten (kennung, name, objekt_id) VALUES (?, ?, ?)",
            (kennung, name, objekt_id),
        )


def _schema_version_setzen(verbindung: sqlite3.Connection) -> None:
    """Hinterlegt die aktuelle Schema-Version in app_settings."""
    verbindung.execute(
        "INSERT INTO app_settings (schluessel, wert) VALUES ('schema_version', ?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (str(schema.SCHEMA_VERSION),),
    )


def _spalten_nachruesten(verbindung: sqlite3.Connection) -> None:
    """Ergänzt in einer Alt-Datenbank fehlende Spalten (ALTER TABLE).

    Tabellen- und Spaltennamen stammen ausschließlich aus dem Code
    (``schema.NACHRUEST_SPALTEN``), nicht aus Benutzereingaben.
    """
    for tabelle, spalte, definition in schema.NACHRUEST_SPALTEN:
        vorhanden = {
            zeile["name"]
            for zeile in verbindung.execute(f"PRAGMA table_info({tabelle})")
        }
        if spalte not in vorhanden:
            verbindung.execute(
                f"ALTER TABLE {tabelle} ADD COLUMN {spalte} {definition}"
            )


def _gespeicherte_version(verbindung: sqlite3.Connection) -> int | None:
    """Liest die bisher gespeicherte Schema-Version (None = neue Datenbank)."""
    try:
        zeile = verbindung.execute(
            "SELECT wert FROM app_settings WHERE schluessel = 'schema_version'"
        ).fetchone()
    except sqlite3.Error:
        return None
    if zeile is None:
        return None
    try:
        return int(zeile[0])
    except (TypeError, ValueError):
        return None


def _hat_buchungen(verbindung: sqlite3.Connection) -> bool:
    try:
        return verbindung.execute(
            "SELECT 1 FROM buchungen LIMIT 1"
        ).fetchone() is not None
    except sqlite3.Error:
        return False


def _sicherung_vor_update(
    verbindung: sqlite3.Connection, datenbank_pfad: Path, version: int
) -> Path:
    """Legt vor einer Daten-Umstellung eine vollständige Kopie der DB an."""
    ordner = Path(datenbank_pfad).parent / "sicherungen"
    ordner.mkdir(parents=True, exist_ok=True)
    zeitstempel = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    ziel = ordner / f"controlling_vor_update_v{version}_{zeitstempel}.db"
    kopie = sqlite3.connect(str(ziel))
    try:
        verbindung.backup(kopie)
    finally:
        kopie.close()
    return ziel


def _kategorie_finden(
    verbindung: sqlite3.Connection, name: str, typ: str
) -> sqlite3.Row | None:
    return verbindung.execute(
        "SELECT id, name, steuer_art, rolle FROM kategorien "
        "WHERE name = ? COLLATE NOCASE AND typ = ?",
        (name, typ),
    ).fetchone()


def _migration_v10(verbindung: sqlite3.Connection) -> list[str]:
    """Umstellung auf Schema 10 (steuerliche Behandlung).

    * vergibt den bekannten Kategorien eine steuerliche Art und Rolle,
    * benennt die alten Standard-Kategorien verständlich um,
    * ergänzt fehlende Standard-Kategorien (Reparaturen, AfA, Kaution …),
    * korrigiert importierte Buchungen, die wegen des früheren
      Jahreswechsel-Fehlers in der Zukunft liegen (Dezember-Buchungen
      aus dem Januar-Auszug landeten im falschen Jahr).

    Liefert eine Liste verständlicher Hinweise über die Änderungen.
    """
    hinweise: list[str] = []
    umbenannt: list[str] = []
    for (alt, typ), (neu, art, rolle) in schema.KATEGORIE_UMSTELLUNG_V10.items():
        zeile = _kategorie_finden(verbindung, alt, typ)
        if zeile is None:
            zeile = _kategorie_finden(verbindung, neu, typ)
        if zeile is None:
            continue
        if zeile["steuer_art"] is None and art is not None:
            verbindung.execute(
                "UPDATE kategorien SET steuer_art = ? WHERE id = ?",
                (art, zeile["id"]),
            )
        if zeile["rolle"] is None and rolle is not None:
            verbindung.execute(
                "UPDATE kategorien SET rolle = ? WHERE id = ?",
                (rolle, zeile["id"]),
            )
        if zeile["name"] != neu and zeile["name"].lower() == alt.lower():
            if _kategorie_finden(verbindung, neu, typ) is None:
                verbindung.execute(
                    "UPDATE kategorien SET name = ? WHERE id = ?",
                    (neu, zeile["id"]),
                )
                umbenannt.append(f"„{zeile['name']}“ → „{neu}“")
    if umbenannt:
        hinweise.append(
            "Kategorien verständlich umbenannt: " + ", ".join(umbenannt)
        )

    neu_angelegt: list[str] = []
    for name, typ, art, rolle in schema.SEED_KATEGORIEN:
        if _kategorie_finden(verbindung, name, typ) is None:
            verbindung.execute(
                "INSERT INTO kategorien (name, typ, aktiv, steuer_art, rolle) "
                "VALUES (?, ?, 1, ?, ?)",
                (name, typ, art, rolle),
            )
            neu_angelegt.append(name)
    if neu_angelegt:
        hinweise.append(
            "Neue Kategorien angelegt: " + ", ".join(neu_angelegt)
        )

    # Jahreswechsel-Fehler: importierte Buchung liegt in der Zukunft und
    # stammt aus November/Dezember → gehört ins Vorjahr.
    heute = date.today().isoformat()
    verschoben = 0
    for zeile in verbindung.execute(
        "SELECT * FROM buchungen WHERE quelle = 'import' AND datum > ? "
        "AND substr(datum, 6, 2) IN ('11', '12')",
        (heute,),
    ).fetchall():
        alt_datum = zeile["datum"]
        neu_datum = f"{int(alt_datum[:4]) - 1:04d}{alt_datum[4:]}"
        verbindung.execute(
            "UPDATE buchungen SET datum = ? WHERE id = ?",
            (neu_datum, zeile["id"]),
        )
        verbindung.execute(
            "INSERT INTO aktionen (zeit, art, tabelle, datensatz_id, "
            "zustand_alt, zustand_neu, zurueckgesetzt) "
            "VALUES (?, 'aendern', 'buchungen', ?, ?, ?, 0)",
            (
                datetime.now().isoformat(timespec="seconds"), zeile["id"],
                json.dumps({"id": zeile["id"], "datum": alt_datum}),
                json.dumps({"id": zeile["id"], "datum": neu_datum}),
            ),
        )
        # Mietzahlungs-Checkliste mitziehen (falls dafür abgehakt).
        if zeile["mieter_id"] is not None:
            monat = int(alt_datum[5:7])
            jahr_alt = int(alt_datum[:4])
            belegt = verbindung.execute(
                "SELECT 1 FROM mietzahlungen WHERE mieter_id = ? "
                "AND monat = ? AND jahr = ?",
                (zeile["mieter_id"], monat, jahr_alt - 1),
            ).fetchone()
            if belegt is None:
                verbindung.execute(
                    "UPDATE mietzahlungen SET jahr = ? WHERE mieter_id = ? "
                    "AND monat = ? AND jahr = ?",
                    (jahr_alt - 1, zeile["mieter_id"], monat, jahr_alt),
                )
        verschoben += 1
    if verschoben:
        hinweise.append(
            f"{verschoben} importierte Buchung(en) lagen wegen des "
            "Jahreswechsel-Fehlers in der Zukunft und wurden ins Vorjahr "
            "korrigiert (im Aktions-Log nachvollziehbar)."
        )
    return hinweise


def datenbank_initialisieren(datenbank_pfad: Path) -> sqlite3.Connection:
    """Stellt die Datenbank bereit und liefert eine offene Verbindung.

    Legt Datei, Tabellen und (beim ersten Start) Stammdaten an und
    rüstet in älteren Datenbanken fehlende Spalten nach.
    """
    verbindung = database.verbindung_aufbauen(datenbank_pfad)
    try:
        alte_version = _gespeicherte_version(verbindung)
        if (alte_version is not None and alte_version < 10
                and _hat_buchungen(verbindung)):
            _sicherung_vor_update(verbindung, datenbank_pfad, 10)
        _tabellen_anlegen(verbindung)
        _spalten_nachruesten(verbindung)
        _stammdaten_einfuegen(verbindung)
        hinweise: list[str] = []
        if alte_version is not None and alte_version < 10:
            hinweise += _migration_v10(verbindung)
        if hinweise:
            verbindung.execute(
                "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
                "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
                (SCHLUESSEL_UPDATE_HINWEIS, "\n\n".join(hinweise)),
            )
        _schema_version_setzen(verbindung)
        verbindung.execute(
            "INSERT INTO app_settings (schluessel, wert) VALUES ('erstellt_am', ?) "
            "ON CONFLICT(schluessel) DO NOTHING",
            (date.today().isoformat(),),
        )
        verbindung.commit()
    except sqlite3.Error:
        verbindung.rollback()
        verbindung.close()
        raise
    return verbindung
