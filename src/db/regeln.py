"""Datenzugriff für benutzerdefinierte Regeln (Tabelle ``regeln``).

Eine Regel ist eine vom Nutzer angelegte Zuordnungsvorgabe: Wenn der
normalisierte Empfängertext einer eingehenden Buchung den Regel-Suchtext
enthält, werden Haus, Kategorie und/oder Mieter laut Regel vorbelegt.
Regeln gewinnen vor den gelernten Mustern und werden in den Stammdaten
gepflegt.
"""

from __future__ import annotations

import sqlite3

from src.utils.eingaben import ValidierungsFehler


def regeln_laden(
    verbindung: sqlite3.Connection, nur_aktive: bool = False
) -> list[sqlite3.Row]:
    """Lädt alle Regeln inkl. Namen der zugeordneten Stammdaten."""
    sql = (
        "SELECT r.id, r.muster, r.objekt_id, r.kategorie_id, r.mieter_id, "
        "r.aktiv, o.name AS objekt_name, k.name AS kategorie_name, "
        "m.name AS mieter_name "
        "FROM regeln r "
        "LEFT JOIN objekte o ON o.id = r.objekt_id "
        "LEFT JOIN kategorien k ON k.id = r.kategorie_id "
        "LEFT JOIN mieter m ON m.id = r.mieter_id"
    )
    if nur_aktive:
        sql += " WHERE r.aktiv = 1"
    sql += " ORDER BY r.muster COLLATE NOCASE"
    return verbindung.execute(sql).fetchall()


def regel_anlegen(
    verbindung: sqlite3.Connection,
    muster: str,
    objekt_id: int | None,
    kategorie_id: int | None,
    mieter_id: int | None,
) -> int:
    """Legt eine neue Regel an. Mindestens eine Zuordnung muss gesetzt sein."""
    muster = muster.strip()
    if not muster:
        raise ValidierungsFehler("Das Such-Muster darf nicht leer sein.")
    if objekt_id is None and kategorie_id is None and mieter_id is None:
        raise ValidierungsFehler(
            "Mindestens ein Ziel (Haus, Kategorie oder Mieter) angeben."
        )
    cursor = verbindung.execute(
        "INSERT INTO regeln (muster, objekt_id, kategorie_id, mieter_id, aktiv) "
        "VALUES (?, ?, ?, ?, 1)",
        (muster.upper(), objekt_id, kategorie_id, mieter_id),
    )
    verbindung.commit()
    return cursor.lastrowid


def regel_aktualisieren(
    verbindung: sqlite3.Connection,
    regel_id: int,
    muster: str,
    objekt_id: int | None,
    kategorie_id: int | None,
    mieter_id: int | None,
) -> None:
    """Aktualisiert eine bestehende Regel."""
    muster = muster.strip()
    if not muster:
        raise ValidierungsFehler("Das Such-Muster darf nicht leer sein.")
    verbindung.execute(
        "UPDATE regeln SET muster = ?, objekt_id = ?, kategorie_id = ?, "
        "mieter_id = ? WHERE id = ?",
        (muster.upper(), objekt_id, kategorie_id, mieter_id, regel_id),
    )
    verbindung.commit()


def regel_aktiv_setzen(
    verbindung: sqlite3.Connection, regel_id: int, aktiv: bool
) -> None:
    """Aktiviert oder deaktiviert eine Regel."""
    verbindung.execute(
        "UPDATE regeln SET aktiv = ? WHERE id = ?",
        (1 if aktiv else 0, regel_id),
    )
    verbindung.commit()


def regel_loeschen(verbindung: sqlite3.Connection, regel_id: int) -> None:
    """Löscht eine Regel."""
    verbindung.execute("DELETE FROM regeln WHERE id = ?", (regel_id,))
    verbindung.commit()


def regel_finden(
    verbindung: sqlite3.Connection, normalisierter_text: str
) -> sqlite3.Row | None:
    """Liefert die am besten passende aktive Regel oder None.

    Gewinnt das längste (also spezifischste) Muster, das im normalisierten
    Empfängertext enthalten ist.
    """
    if not normalisierter_text:
        return None
    bester: sqlite3.Row | None = None
    for regel in regeln_laden(verbindung, nur_aktive=True):
        muster = (regel["muster"] or "").upper()
        if muster and muster in normalisierter_text:
            if bester is None or len(muster) > len(bester["muster"]):
                bester = regel
    return bester
