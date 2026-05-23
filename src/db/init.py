"""Initialisierung der Datenbank.

Beim allerersten Start werden alle Tabellen angelegt und die
vordefinierten Stammdaten (Häuser, Kategorien) eingefügt. Bei späteren
Starts wird nur sichergestellt, dass alle Tabellen vorhanden sind.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path

from src.db import database, schema


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
            "INSERT INTO kategorien (name, typ, aktiv) VALUES (?, 'ausgabe', 1)",
            [(name,) for name in schema.SEED_KATEGORIEN_AUSGABE],
        )
        verbindung.executemany(
            "INSERT INTO kategorien (name, typ, aktiv) VALUES (?, 'einnahme', 1)",
            [(name,) for name in schema.SEED_KATEGORIEN_EINNAHME],
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


def datenbank_initialisieren(datenbank_pfad: Path) -> sqlite3.Connection:
    """Stellt die Datenbank bereit und liefert eine offene Verbindung.

    Legt Datei, Tabellen und (beim ersten Start) Stammdaten an und
    rüstet in älteren Datenbanken fehlende Spalten nach.
    """
    verbindung = database.verbindung_aufbauen(datenbank_pfad)
    try:
        _tabellen_anlegen(verbindung)
        _spalten_nachruesten(verbindung)
        _stammdaten_einfuegen(verbindung)
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
