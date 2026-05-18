"""Datenzugriff für Buchungen und die Jahres-Auswertung des Dashboards.

Alle Geldbeträge werden als TEXT (Decimal-Darstellung) gespeichert und
beim Auswerten als ``Decimal`` zurückgelesen.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from src.utils.eingaben import ValidierungsFehler


def buchungen_laden(
    verbindung: sqlite3.Connection,
    objekt_id: int | None = None,
    kategorie_id: int | None = None,
    monat: int | None = None,
    jahr: int | None = None,
) -> list[sqlite3.Row]:
    """Lädt Buchungen, optional gefiltert nach Haus, Kategorie, Monat, Jahr."""
    sql = (
        "SELECT b.id, b.datum, b.betrag, b.objekt_id, b.kategorie_id, "
        "b.beschreibung, b.beleg_pfad, b.quelle, "
        "o.name AS objekt_name, k.name AS kategorie_name, k.typ AS kategorie_typ "
        "FROM buchungen b "
        "LEFT JOIN objekte o ON o.id = b.objekt_id "
        "LEFT JOIN kategorien k ON k.id = b.kategorie_id "
        "WHERE 1 = 1"
    )
    parameter: list = []
    if objekt_id is not None:
        sql += " AND b.objekt_id = ?"
        parameter.append(objekt_id)
    if kategorie_id is not None:
        sql += " AND b.kategorie_id = ?"
        parameter.append(kategorie_id)
    if jahr is not None:
        sql += " AND substr(b.datum, 1, 4) = ?"
        parameter.append(f"{jahr:04d}")
    if monat is not None:
        sql += " AND substr(b.datum, 6, 2) = ?"
        parameter.append(f"{monat:02d}")
    sql += " ORDER BY b.datum DESC, b.id DESC"
    return verbindung.execute(sql, parameter).fetchall()


def buchung_anlegen(
    verbindung: sqlite3.Connection,
    datum: str,
    betrag: Decimal,
    objekt_id: int,
    kategorie_id: int,
    beschreibung: str,
    beleg_pfad: str | None,
    quelle: str,
) -> int:
    """Legt eine neue Buchung an und liefert deren ID."""
    if not datum:
        raise ValidierungsFehler("Bitte ein Datum angeben.")
    cursor = verbindung.execute(
        "INSERT INTO buchungen "
        "(datum, betrag, objekt_id, kategorie_id, beschreibung, beleg_pfad, quelle) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (datum, str(betrag), objekt_id, kategorie_id,
         beschreibung, beleg_pfad, quelle),
    )
    verbindung.commit()
    return cursor.lastrowid


def buchung_aktualisieren(
    verbindung: sqlite3.Connection,
    buchung_id: int,
    datum: str,
    betrag: Decimal,
    objekt_id: int,
    kategorie_id: int,
    beschreibung: str,
    beleg_pfad: str | None,
) -> None:
    """Aktualisiert eine bestehende Buchung."""
    if not datum:
        raise ValidierungsFehler("Bitte ein Datum angeben.")
    verbindung.execute(
        "UPDATE buchungen SET datum = ?, betrag = ?, objekt_id = ?, "
        "kategorie_id = ?, beschreibung = ?, beleg_pfad = ? WHERE id = ?",
        (datum, str(betrag), objekt_id, kategorie_id,
         beschreibung, beleg_pfad, buchung_id),
    )
    verbindung.commit()


def buchung_loeschen(verbindung: sqlite3.Connection, buchung_id: int) -> None:
    """Löscht eine Buchung."""
    verbindung.execute("DELETE FROM buchungen WHERE id = ?", (buchung_id,))
    verbindung.commit()


def buchung_beleg_setzen(
    verbindung: sqlite3.Connection, buchung_id: int, beleg_pfad: str
) -> None:
    """Hinterlegt den Belegpfad einer bestehenden Buchung."""
    verbindung.execute(
        "UPDATE buchungen SET beleg_pfad = ? WHERE id = ?",
        (beleg_pfad, buchung_id),
    )
    verbindung.commit()


def jahre_laden(verbindung: sqlite3.Connection) -> list[int]:
    """Liefert alle Jahre, für die Buchungen existieren (absteigend)."""
    zeilen = verbindung.execute(
        "SELECT DISTINCT substr(datum, 1, 4) AS jahr FROM buchungen "
        "ORDER BY jahr DESC"
    ).fetchall()
    return [int(z["jahr"]) for z in zeilen if z["jahr"]]


def jahres_auswertung(
    verbindung: sqlite3.Connection, jahr: int
) -> dict[int, dict]:
    """Aggregiert Einnahmen und Ausgaben eines Jahres je Haus.

    Liefert ein Dictionary ``{objekt_id: {...}}`` mit Jahressummen und
    Monatssummen für Einnahmen und Ausgaben.
    """
    zeilen = verbindung.execute(
        "SELECT b.objekt_id AS oid, substr(b.datum, 6, 2) AS monat, "
        "b.betrag AS betrag, k.typ AS typ "
        "FROM buchungen b "
        "LEFT JOIN kategorien k ON k.id = b.kategorie_id "
        "WHERE substr(b.datum, 1, 4) = ?",
        (f"{jahr:04d}",),
    ).fetchall()

    ergebnis: dict[int, dict] = {}
    for zeile in zeilen:
        if zeile["typ"] not in ("einnahme", "ausgabe"):
            continue
        if zeile["oid"] is None:
            continue
        eintrag = ergebnis.setdefault(
            zeile["oid"],
            {
                "einnahmen": Decimal("0"),
                "ausgaben": Decimal("0"),
                "anzahl": 0,
                "monat_einnahmen": {m: Decimal("0") for m in range(1, 13)},
                "monat_ausgaben": {m: Decimal("0") for m in range(1, 13)},
            },
        )
        try:
            betrag = Decimal(zeile["betrag"])
        except (ValueError, TypeError):
            continue
        eintrag["anzahl"] += 1
        try:
            monat = int(zeile["monat"])
        except (ValueError, TypeError):
            monat = 0

        if zeile["typ"] == "einnahme":
            eintrag["einnahmen"] += betrag
            if 1 <= monat <= 12:
                eintrag["monat_einnahmen"][monat] += betrag
        else:
            eintrag["ausgaben"] += betrag
            if 1 <= monat <= 12:
                eintrag["monat_ausgaben"][monat] += betrag
    return ergebnis
