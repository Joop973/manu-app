"""Datensicherung: Datenbank und Belege sichern.

Bei jeder Sicherung wird eine **datierte** Kopie der Datenbank im
Unterordner ``sicherungen/`` abgelegt (``controlling_<Zeitstempel>.db``).
So bleibt bei einer beschädigten Datenbank ein älterer, intakter Stand
erhalten. Die ältesten Sicherungen werden automatisch entfernt, sobald
die Höchstzahl überschritten wird.

Der Belege-Ordner wird zusätzlich nach ``belege_backup/`` gespiegelt.
Zielordner ist standardmäßig das App-Verzeichnis; über die
Einstellungen lässt sich ein anderer Ordner festlegen.
"""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from src.db.einstellungen import SCHLUESSEL_BACKUP_PFAD, einstellung_lesen
from src.utils import paths

# So viele datierte Datenbank-Sicherungen werden aufbewahrt.
SICHERUNGEN_BEHALTEN = 15


def backup_ziel(verbindung: sqlite3.Connection) -> Path:
    """Liefert den konfigurierten Backup-Ordner (oder den Standardordner)."""
    eingestellt = einstellung_lesen(verbindung, SCHLUESSEL_BACKUP_PFAD)
    if eingestellt:
        return Path(eingestellt)
    return paths.app_verzeichnis()


def _alte_sicherungen_entfernen(ordner: Path) -> None:
    """Löscht die ältesten Sicherungen, bis die Höchstzahl eingehalten ist."""
    # Der Zeitstempel im Namen sorgt dafür, dass die Sortierung nach Name
    # gleichbedeutend mit der zeitlichen Reihenfolge ist.
    dateien = sorted(ordner.glob("controlling_*.db"))
    ueberzaehlig = dateien[:-SICHERUNGEN_BEHALTEN] if (
        len(dateien) > SICHERUNGEN_BEHALTEN
    ) else []
    for datei in ueberzaehlig:
        try:
            datei.unlink()
        except OSError:
            pass


def datensicherung_durchfuehren(verbindung: sqlite3.Connection) -> Path:
    """Sichert Datenbank und Belege; liefert den verwendeten Zielordner."""
    ziel = backup_ziel(verbindung)
    sicherungen = ziel / "sicherungen"
    sicherungen.mkdir(parents=True, exist_ok=True)

    # WAL-Inhalt in die Hauptdatei schreiben, damit die Kopie vollständig ist.
    try:
        verbindung.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except sqlite3.Error:
        pass

    datenbank = paths.datenbank_pfad()
    if datenbank.is_file():
        zeitstempel = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        shutil.copy2(datenbank, sicherungen / f"controlling_{zeitstempel}.db")
        _alte_sicherungen_entfernen(sicherungen)

    belege = paths.belege_verzeichnis()
    if belege.is_dir():
        shutil.copytree(belege, ziel / "belege_backup", dirs_exist_ok=True)

    return ziel
