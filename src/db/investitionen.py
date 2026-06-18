"""Investitionen je Haus und Berechnung der jährlichen AfA.

Eine Investition ist entweder **Erhaltungsaufwand** (Reparatur,
sofort als Werbungskosten absetzbar) oder **Herstellungsaufwand**
(Modernisierung/Anschaffung, über die Nutzungsdauer abgeschrieben).
Bei Herstellungsaufwand verteilt die AfA-Berechnung den Betrag
linear; im Anschaffungsjahr wird nur der pro-rata-Anteil
ab dem Anschaffungsmonat angesetzt.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal

from src.utils.eingaben import ValidierungsFehler

TYPEN = {
    "erhaltung": "Erhaltungsaufwand (sofort absetzbar)",
    "herstellung": "Herstellungsaufwand (über Nutzungsdauer / AfA)",
}


def investitionen_laden(
    verbindung: sqlite3.Connection,
    objekt_id: int | None = None,
) -> list[sqlite3.Row]:
    """Lädt Investitionen, optional gefiltert auf ein Haus."""
    sql = (
        "SELECT i.id, i.objekt_id, i.datum, i.betrag, i.beschreibung, "
        "i.typ, i.nutzungsdauer, i.beleg_pfad, o.name AS objekt_name "
        "FROM investitionen i "
        "LEFT JOIN objekte o ON o.id = i.objekt_id"
    )
    parameter: list = []
    if objekt_id is not None:
        sql += " WHERE i.objekt_id = ?"
        parameter.append(objekt_id)
    sql += " ORDER BY i.datum DESC, i.id DESC"
    return verbindung.execute(sql, parameter).fetchall()


def investition_anlegen(
    verbindung: sqlite3.Connection,
    objekt_id: int,
    datum: str,
    betrag: Decimal,
    beschreibung: str,
    typ: str,
    nutzungsdauer: int,
    beleg_pfad: str | None = None,
) -> int:
    """Legt eine neue Investition an."""
    if typ not in TYPEN:
        raise ValidierungsFehler("Ungültiger Investitionstyp.")
    if betrag <= 0:
        raise ValidierungsFehler("Der Betrag muss positiv sein.")
    if typ == "herstellung" and nutzungsdauer < 1:
        raise ValidierungsFehler("Nutzungsdauer muss mindestens 1 Jahr sein.")
    cursor = verbindung.execute(
        "INSERT INTO investitionen "
        "(objekt_id, datum, betrag, beschreibung, typ, nutzungsdauer, beleg_pfad) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (objekt_id, datum, str(betrag), beschreibung.strip(), typ,
         nutzungsdauer, beleg_pfad),
    )
    verbindung.commit()
    return cursor.lastrowid


def investition_aktualisieren(
    verbindung: sqlite3.Connection,
    investition_id: int,
    objekt_id: int,
    datum: str,
    betrag: Decimal,
    beschreibung: str,
    typ: str,
    nutzungsdauer: int,
    beleg_pfad: str | None = None,
) -> None:
    """Aktualisiert eine bestehende Investition."""
    if typ not in TYPEN:
        raise ValidierungsFehler("Ungültiger Investitionstyp.")
    verbindung.execute(
        "UPDATE investitionen SET objekt_id = ?, datum = ?, betrag = ?, "
        "beschreibung = ?, typ = ?, nutzungsdauer = ?, beleg_pfad = ? "
        "WHERE id = ?",
        (objekt_id, datum, str(betrag), beschreibung.strip(), typ,
         nutzungsdauer, beleg_pfad, investition_id),
    )
    verbindung.commit()


def investition_loeschen(
    verbindung: sqlite3.Connection, investition_id: int
) -> None:
    """Löscht eine Investition."""
    verbindung.execute(
        "DELETE FROM investitionen WHERE id = ?", (investition_id,)
    )
    verbindung.commit()


def afa_im_jahr(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> dict:
    """Berechnet AfA und sofort abzugsfähige Erhaltungsaufwendungen.

    Liefert ein Dict mit:
    * ``erhaltung``: Summe aller Erhaltungsaufwendungen dieses Jahres
    * ``afa``: Summe der AfA-Anteile aller Herstellungs-Investitionen,
      die das Jahr berühren (inkl. pro-rata im Anschaffungsjahr)
    * ``positionen``: Detail-Aufstellung für den Bericht
    """
    erhaltung = Decimal("0")
    afa_summe = Decimal("0")
    positionen: list[dict] = []
    for inv in investitionen_laden(verbindung, objekt_id):
        try:
            betrag = Decimal(inv["betrag"])
            inv_jahr = int(inv["datum"][:4])
            inv_monat = int(inv["datum"][5:7])
        except (ValueError, TypeError, IndexError):
            continue
        if inv["typ"] == "erhaltung":
            if inv_jahr == jahr:
                erhaltung += betrag
                positionen.append({
                    "datum": inv["datum"],
                    "beschreibung": inv["beschreibung"] or "",
                    "typ": "Erhaltung",
                    "anteil": betrag,
                    "gesamt": betrag,
                })
            continue
        # Herstellungsaufwand → AfA linear über Nutzungsdauer
        nutzungsdauer = int(inv["nutzungsdauer"] or 50)
        jahres_afa = betrag / Decimal(nutzungsdauer)
        ende_jahr = inv_jahr + nutzungsdauer - 1
        if jahr < inv_jahr or jahr > ende_jahr:
            continue
        if jahr == inv_jahr:
            # Pro rata: nur ab Anschaffungsmonat
            monate = 13 - inv_monat
            anteil = (jahres_afa * Decimal(monate) / Decimal(12)).quantize(
                Decimal("0.01")
            )
        else:
            anteil = jahres_afa.quantize(Decimal("0.01"))
        afa_summe += anteil
        positionen.append({
            "datum": inv["datum"],
            "beschreibung": inv["beschreibung"] or "",
            "typ": f"AfA {nutzungsdauer} J.",
            "anteil": anteil,
            "gesamt": betrag,
        })
    return {
        "erhaltung": erhaltung,
        "afa": afa_summe,
        "positionen": positionen,
    }
