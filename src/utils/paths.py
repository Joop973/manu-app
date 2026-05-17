"""Zentrale Pfadverwaltung der Anwendung.

Alle Datei- und Ordnerzugriffe laufen über dieses Modul, damit die App
sowohl als Python-Skript als auch als gepackte .exe (PyInstaller) am
richtigen Ort speichert: stets neben der ausführbaren Datei bzw. im
Projektverzeichnis.
"""

from __future__ import annotations

import sys
from pathlib import Path


def app_verzeichnis() -> Path:
    """Liefert das Verzeichnis, in dem die App ihre Daten ablegt.

    Als gepackte .exe ist das der Ordner der .exe-Datei, im
    Entwicklungsbetrieb das Projekt-Stammverzeichnis (ManuApp/).
    """
    if getattr(sys, "frozen", False):
        # Von PyInstaller erzeugte .exe
        return Path(sys.executable).resolve().parent
    # Entwicklungsbetrieb: diese Datei liegt in src/utils/paths.py
    return Path(__file__).resolve().parents[2]


def datenbank_pfad() -> Path:
    """Pfad zur SQLite-Hauptdatenbank."""
    return app_verzeichnis() / "controlling.db"


def datenbank_backup_pfad() -> Path:
    """Pfad zur automatischen Backup-Kopie der Datenbank."""
    return app_verzeichnis() / "controlling_backup.db"


def belege_verzeichnis() -> Path:
    """Ordner für archivierte Belege."""
    return app_verzeichnis() / "belege"


def exporte_verzeichnis() -> Path:
    """Ordner für Excel-Exporte."""
    return app_verzeichnis() / "exports"


def verzeichnisse_sicherstellen() -> None:
    """Legt die benötigten Arbeitsordner an, falls sie noch fehlen."""
    for ordner in (belege_verzeichnis(), exporte_verzeichnis()):
        ordner.mkdir(parents=True, exist_ok=True)
