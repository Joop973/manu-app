"""Archivierung von Belegdateien.

Belege werden nach ``belege/<jahr>/`` kopiert. Gespeichert wird ein zum
App-Verzeichnis relativer Pfad, damit die Anwendung als portable .exe
verschoben werden kann, ohne dass Belegverweise brechen.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from src.utils import paths


def beleg_archivieren(quell_pfad: str | Path, jahr: int) -> str:
    """Kopiert eine Belegdatei ins Archiv und liefert den relativen Pfad.

    Bei Namenskollisionen wird ein Zähler an den Dateinamen angehängt.
    """
    quelle = Path(quell_pfad)
    if not quelle.is_file():
        raise FileNotFoundError(f"Die Datei wurde nicht gefunden: {quelle}")

    ziel_ordner = paths.belege_verzeichnis() / f"{jahr:04d}"
    ziel_ordner.mkdir(parents=True, exist_ok=True)

    ziel = ziel_ordner / quelle.name
    zaehler = 1
    while ziel.exists():
        ziel = ziel_ordner / f"{quelle.stem}_{zaehler}{quelle.suffix}"
        zaehler += 1

    shutil.copy2(quelle, ziel)
    return str(ziel.relative_to(paths.app_verzeichnis()))


def beleg_absolut(relativer_pfad: str) -> Path:
    """Wandelt einen gespeicherten relativen Belegpfad in einen absoluten."""
    return paths.app_verzeichnis() / relativer_pfad
