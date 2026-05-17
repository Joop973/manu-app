"""Aufbau von SQLite-Verbindungen.

Kapselt die immer gleichen Verbindungseinstellungen an einer Stelle:
* ``row_factory`` für Zugriff auf Spalten per Name
* aktivierte Fremdschlüssel-Prüfung (``PRAGMA foreign_keys``)
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def verbindung_aufbauen(datenbank_pfad: Path) -> sqlite3.Connection:
    """Öffnet eine SQLite-Verbindung mit den App-Standardeinstellungen."""
    verbindung = sqlite3.connect(str(datenbank_pfad))
    verbindung.row_factory = sqlite3.Row
    verbindung.execute("PRAGMA foreign_keys = ON")
    return verbindung
