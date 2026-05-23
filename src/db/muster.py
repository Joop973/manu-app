"""Datenzugriff für das Lernsystem (Tabelle ``buchungsmuster``).

Ein Buchungsmuster verknüpft einen normalisierten Erkennungstext
(typischerweise der Empfängername) mit einem Haus und einer Kategorie.
Beim Import werden neue Buchungen über einen Substring-Vergleich des
normalisierten Textes automatisch zugeordnet.
"""

from __future__ import annotations

import sqlite3
from datetime import date


def muster_laden(verbindung: sqlite3.Connection) -> list[sqlite3.Row]:
    """Lädt alle gespeicherten Buchungsmuster."""
    return verbindung.execute(
        "SELECT id, erkennungstext, objekt_id, kategorie_id, bestaetigt_am "
        "FROM buchungsmuster ORDER BY erkennungstext"
    ).fetchall()


def muster_uebersicht(verbindung: sqlite3.Connection) -> list[sqlite3.Row]:
    """Lädt alle Muster inklusive Haus- und Kategoriename (für die Anzeige)."""
    return verbindung.execute(
        "SELECT m.id, m.erkennungstext, m.objekt_id, m.kategorie_id, "
        "m.bestaetigt_am, o.name AS objekt_name, k.name AS kategorie_name "
        "FROM buchungsmuster m "
        "LEFT JOIN objekte o ON o.id = m.objekt_id "
        "LEFT JOIN kategorien k ON k.id = m.kategorie_id "
        "ORDER BY m.erkennungstext"
    ).fetchall()


def muster_aktualisieren(
    verbindung: sqlite3.Connection,
    muster_id: int,
    objekt_id: int,
    kategorie_id: int,
) -> None:
    """Ändert die Zuordnung eines bestehenden Musters."""
    verbindung.execute(
        "UPDATE buchungsmuster SET objekt_id = ?, kategorie_id = ? WHERE id = ?",
        (objekt_id, kategorie_id, muster_id),
    )
    verbindung.commit()


def muster_loeschen(verbindung: sqlite3.Connection, muster_id: int) -> None:
    """Löscht ein gelerntes Buchungsmuster."""
    verbindung.execute("DELETE FROM buchungsmuster WHERE id = ?", (muster_id,))
    verbindung.commit()


def muster_finden(
    verbindung: sqlite3.Connection, normalisierter_text: str
) -> sqlite3.Row | None:
    """Sucht das am besten passende Muster für einen normalisierten Text.

    Ein Muster passt, wenn sein Erkennungstext im übergebenen Text
    enthalten ist. Bei mehreren Treffern gewinnt der längste (und damit
    spezifischste) Erkennungstext.
    """
    if not normalisierter_text:
        return None
    bester: sqlite3.Row | None = None
    for muster in muster_laden(verbindung):
        erkennung = muster["erkennungstext"]
        if erkennung and erkennung in normalisierter_text:
            if bester is None or len(erkennung) > len(bester["erkennungstext"]):
                bester = muster
    return bester


def muster_speichern(
    verbindung: sqlite3.Connection,
    erkennungstext: str,
    objekt_id: int,
    kategorie_id: int,
) -> None:
    """Speichert ein Muster bzw. aktualisiert ein bereits vorhandenes."""
    erkennungstext = erkennungstext.strip()
    if not erkennungstext:
        return
    heute = date.today().isoformat()
    vorhanden = verbindung.execute(
        "SELECT id FROM buchungsmuster WHERE erkennungstext = ?",
        (erkennungstext,),
    ).fetchone()
    if vorhanden is None:
        verbindung.execute(
            "INSERT INTO buchungsmuster "
            "(erkennungstext, objekt_id, kategorie_id, bestaetigt_am) "
            "VALUES (?, ?, ?, ?)",
            (erkennungstext, objekt_id, kategorie_id, heute),
        )
    else:
        verbindung.execute(
            "UPDATE buchungsmuster SET objekt_id = ?, kategorie_id = ?, "
            "bestaetigt_am = ? WHERE id = ?",
            (objekt_id, kategorie_id, heute, vorhanden["id"]),
        )
    verbindung.commit()
