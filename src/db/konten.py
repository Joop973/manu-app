"""Zuordnung von Bankkonten zu einem Standard-Haus.

Jedes Konto wird über die Endung seiner Kontonummer erkannt (z. B.
"100"). Ein Konto kann ein Standard-Haus haben (dann landen dort alle
nicht anderweitig zuordenbaren Buchungen) oder keins (mehrere Häuser
teilen das Konto; dann entscheidet die Erkennung, Unklares bleibt zur
Kontrolle stehen).
"""

from __future__ import annotations

import sqlite3

from src.utils.eingaben import ValidierungsFehler


def konten_laden(verbindung: sqlite3.Connection) -> list[sqlite3.Row]:
    """Lädt alle Konto-Zuordnungen inkl. Hausname."""
    return verbindung.execute(
        "SELECT k.id, k.kennung, k.name, k.objekt_id, o.name AS objekt_name "
        "FROM konten k LEFT JOIN objekte o ON o.id = k.objekt_id "
        "ORDER BY k.kennung"
    ).fetchall()


def konto_anlegen(
    verbindung: sqlite3.Connection,
    kennung: str,
    name: str,
    objekt_id: int | None,
) -> int:
    """Legt eine neue Konto-Zuordnung an."""
    kennung = (kennung or "").strip()
    if not kennung:
        raise ValidierungsFehler("Die Konto-Kennung darf nicht leer sein.")
    if verbindung.execute(
        "SELECT 1 FROM konten WHERE kennung = ?", (kennung,)
    ).fetchone():
        raise ValidierungsFehler(f"Ein Konto „{kennung}“ existiert bereits.")
    cursor = verbindung.execute(
        "INSERT INTO konten (kennung, name, objekt_id) VALUES (?, ?, ?)",
        (kennung, name.strip() or None, objekt_id),
    )
    verbindung.commit()
    return cursor.lastrowid


def konto_aktualisieren(
    verbindung: sqlite3.Connection,
    konto_id: int,
    kennung: str,
    name: str,
    objekt_id: int | None,
) -> None:
    """Aktualisiert eine bestehende Konto-Zuordnung."""
    kennung = (kennung or "").strip()
    if not kennung:
        raise ValidierungsFehler("Die Konto-Kennung darf nicht leer sein.")
    verbindung.execute(
        "UPDATE konten SET kennung = ?, name = ?, objekt_id = ? WHERE id = ?",
        (kennung, name.strip() or None, objekt_id, konto_id),
    )
    verbindung.commit()


def konto_loeschen(verbindung: sqlite3.Connection, konto_id: int) -> None:
    """Löscht eine Konto-Zuordnung."""
    verbindung.execute("DELETE FROM konten WHERE id = ?", (konto_id,))
    verbindung.commit()


def standard_haus_fuer_konto(
    verbindung: sqlite3.Connection, kontonummer: str | None
) -> tuple[bool, int | None]:
    """Ermittelt das Standard-Haus für eine Kontonummer aus dem Auszug.

    Liefert ``(gefunden, objekt_id)``:
    * ``gefunden=True``  — eine Konto-Zuordnung passt; ``objekt_id`` ist
      das Standard-Haus (oder ``None``, wenn das Konto bewusst keins hat).
    * ``gefunden=False`` — keine Zuordnung passt; der Aufrufer sollte auf
      die globale Standard-Haus-Einstellung zurückfallen.

    Passt die Endung der ``kennung`` auf die Kontonummer, gewinnt die
    längste (spezifischste) Kennung.
    """
    if not kontonummer:
        return False, None
    bester: sqlite3.Row | None = None
    for konto in konten_laden(verbindung):
        kennung = (konto["kennung"] or "").strip()
        if kennung and kontonummer.endswith(kennung):
            if bester is None or len(kennung) > len(bester["kennung"]):
                bester = konto
    if bester is None:
        return False, None
    return True, bester["objekt_id"]
