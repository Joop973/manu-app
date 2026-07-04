"""Gedächtnis bereits importierter Kontoauszüge (Dubletten-Schutz).

Jeder Auszug trägt im Kopf eine eindeutige Kennung ("Kontoauszug
Nr. 3/2026"). Nach erfolgreichem Import wird sie hier vermerkt; beim
nächsten Import desselben Auszugs wird die Datei übersprungen.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime


def ist_importiert(
    verbindung: sqlite3.Connection, kennung: str
) -> sqlite3.Row | None:
    """Liefert den Vermerk zu einer Auszugs-Kennung oder None."""
    if not kennung:
        return None
    return verbindung.execute(
        "SELECT kennung, dateiname, importiert_am FROM importierte_auszuege "
        "WHERE kennung = ?",
        (kennung,),
    ).fetchone()


def vermerken(
    verbindung: sqlite3.Connection, kennung: str, dateiname: str
) -> None:
    """Merkt sich einen Auszug als importiert (idempotent)."""
    if not kennung:
        return
    verbindung.execute(
        "INSERT INTO importierte_auszuege (kennung, dateiname, importiert_am) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(kennung) DO UPDATE SET "
        "dateiname = excluded.dateiname, importiert_am = excluded.importiert_am",
        (kennung, dateiname, datetime.now().isoformat(timespec="seconds")),
    )
    verbindung.commit()
