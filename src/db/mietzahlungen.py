"""Datenzugriff für Mietzahlungen.

Wird eine Miete als „eingegangen" markiert, entsteht ein Eintrag in
``mietzahlungen`` sowie je Mietbestandteil (Kaltmiete, Nebenkosten,
Rücklage) eine Einnahme-Buchung. Die zugehörigen Buchungen tragen in
der Spalte ``quelle`` die Markierung ``mietzahlung:<id>``, damit sie
beim Zurücknehmen der Markierung wieder entfernt werden können.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal

from src.utils.eingaben import ValidierungsFehler

# Mietbestandteile und die zugehörigen Einnahme-Kategorien.
_BESTANDTEILE = ("Kaltmiete", "Nebenkosten", "Rücklage")
# Spaltennamen in der Mieter-Tabelle je Bestandteil.
_SPALTEN = {
    "Kaltmiete": "kaltmiete",
    "Nebenkosten": "nebenkosten",
    "Rücklage": "ruecklage",
}


def _einnahme_kategorie_ids(verbindung: sqlite3.Connection) -> dict[str, int | None]:
    """Sucht die IDs der Einnahme-Kategorien je Mietbestandteil."""
    ids: dict[str, int | None] = {}
    for name in _BESTANDTEILE:
        zeile = verbindung.execute(
            "SELECT id FROM kategorien WHERE name = ? AND typ = 'einnahme'",
            (name,),
        ).fetchone()
        ids[name] = zeile["id"] if zeile else None
    return ids


def bezahlte_monate(
    verbindung: sqlite3.Connection, mieter_id: int, jahr: int
) -> set[int]:
    """Liefert die Monate, für die im Jahr bereits eine Miete erfasst ist."""
    zeilen = verbindung.execute(
        "SELECT monat FROM mietzahlungen WHERE mieter_id = ? AND jahr = ?",
        (mieter_id, jahr),
    ).fetchall()
    return {z["monat"] for z in zeilen}


def mietzahlung_erfassen(
    verbindung: sqlite3.Connection, mieter_id: int, monat: int, jahr: int
) -> None:
    """Erfasst eine Mietzahlung und legt die zugehörigen Buchungen an."""
    mieter = verbindung.execute(
        "SELECT objekt_id, name, kaltmiete, nebenkosten, ruecklage "
        "FROM mieter WHERE id = ?",
        (mieter_id,),
    ).fetchone()
    if mieter is None:
        raise ValidierungsFehler("Der Mieter wurde nicht gefunden.")

    # Doppelte Erfassung vermeiden.
    if verbindung.execute(
        "SELECT 1 FROM mietzahlungen WHERE mieter_id = ? AND monat = ? AND jahr = ?",
        (mieter_id, monat, jahr),
    ).fetchone():
        return

    betraege = {
        name: Decimal(mieter[_SPALTEN[name]]) for name in _BESTANDTEILE
    }
    gesamt = sum(betraege.values(), Decimal("0"))

    cursor = verbindung.execute(
        "INSERT INTO mietzahlungen "
        "(mieter_id, monat, jahr, betrag, datum_eingang) VALUES (?, ?, ?, ?, ?)",
        (mieter_id, monat, jahr, str(gesamt), date.today().isoformat()),
    )
    mietzahlung_id = cursor.lastrowid

    kategorie_ids = _einnahme_kategorie_ids(verbindung)
    datum = f"{jahr:04d}-{monat:02d}-01"
    quelle = f"mietzahlung:{mietzahlung_id}"
    for name in _BESTANDTEILE:
        betrag = betraege[name]
        if betrag <= 0:
            continue
        verbindung.execute(
            "INSERT INTO buchungen "
            "(datum, betrag, objekt_id, kategorie_id, mieter_id, "
            "beschreibung, beleg_pfad, quelle) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                datum,
                str(betrag),
                mieter["objekt_id"],
                kategorie_ids[name],
                mieter_id,
                f"{name} von {mieter['name']} ({monat:02d}/{jahr})",
                None,
                quelle,
            ),
        )
    verbindung.commit()


def mietzahlung_entfernen(
    verbindung: sqlite3.Connection, mieter_id: int, monat: int, jahr: int
) -> None:
    """Nimmt eine Mietzahlung samt zugehöriger Buchungen zurück."""
    zeile = verbindung.execute(
        "SELECT id FROM mietzahlungen WHERE mieter_id = ? AND monat = ? AND jahr = ?",
        (mieter_id, monat, jahr),
    ).fetchone()
    if zeile is None:
        return
    verbindung.execute(
        "DELETE FROM buchungen WHERE quelle = ?",
        (f"mietzahlung:{zeile['id']}",),
    )
    verbindung.execute("DELETE FROM mietzahlungen WHERE id = ?", (zeile["id"],))
    verbindung.commit()
