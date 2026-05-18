"""Datensicherung: Datenbank und Belege spiegeln.

Gesichert wird die SQLite-Datei als ``controlling_backup.db`` sowie der
Belege-Ordner als ``belege_backup/``. Zielordner ist standardmäßig das
App-Verzeichnis; über die Einstellungen lässt sich ein anderer Ordner
festlegen.
"""

from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path

from src.db.einstellungen import SCHLUESSEL_BACKUP_PFAD, einstellung_lesen
from src.utils import paths


def backup_ziel(verbindung: sqlite3.Connection) -> Path:
    """Liefert den konfigurierten Backup-Ordner (oder den Standardordner)."""
    eingestellt = einstellung_lesen(verbindung, SCHLUESSEL_BACKUP_PFAD)
    if eingestellt:
        return Path(eingestellt)
    return paths.app_verzeichnis()


def datensicherung_durchfuehren(verbindung: sqlite3.Connection) -> Path:
    """Sichert Datenbank und Belege; liefert den verwendeten Zielordner."""
    ziel = backup_ziel(verbindung)
    ziel.mkdir(parents=True, exist_ok=True)

    # WAL-Inhalt in die Hauptdatei schreiben, damit die Kopie vollständig ist.
    try:
        verbindung.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except sqlite3.Error:
        pass

    datenbank = paths.datenbank_pfad()
    if datenbank.is_file():
        shutil.copy2(datenbank, ziel / "controlling_backup.db")

    belege = paths.belege_verzeichnis()
    if belege.is_dir():
        shutil.copytree(belege, ziel / "belege_backup", dirs_exist_ok=True)

    return ziel
