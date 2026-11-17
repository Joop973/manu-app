"""Investitionen je Haus und Berechnung der jährlichen AfA.

Eine Investition ist entweder **Erhaltungsaufwand** (Reparatur,
sofort als Werbungskosten absetzbar) oder **Herstellungsaufwand**
(Modernisierung/Anschaffung, über die Nutzungsdauer abgeschrieben).
Bei Herstellungsaufwand verteilt die AfA-Berechnung den Betrag
linear; im Anschaffungsjahr wird nur der pro-rata-Anteil
ab dem Anschaffungsmonat angesetzt, der Rest folgt im Jahr nach
Ablauf der Nutzungsdauer (die Summe ergibt exakt den Gesamtbetrag).
Erhaltungsaufwand kann nach § 82b EStDV auf 1–5 Jahre verteilt werden.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal

from src.logic.afa import lineare_afa_plan, verteilung_82b
from src.utils.eingaben import ValidierungsFehler

TYPEN = {
    "erhaltung": "Erhaltungsaufwand (sofort absetzbar)",
    "herstellung": "Herstellungsaufwand (über Nutzungsdauer / AfA)",
}


def _pruefen(
    typ: str, betrag: Decimal, nutzungsdauer: int, verteilung_jahre: int
) -> None:
    if typ not in TYPEN:
        raise ValidierungsFehler("Ungültiger Investitionstyp.")
    if betrag <= 0:
        raise ValidierungsFehler("Der Betrag muss positiv sein.")
    if typ == "herstellung" and nutzungsdauer < 1:
        raise ValidierungsFehler("Nutzungsdauer muss mindestens 1 Jahr sein.")
    if not 1 <= int(verteilung_jahre or 1) <= 5:
        raise ValidierungsFehler(
            "Die Verteilung nach § 82b EStDV ist auf 1 bis 5 Jahre begrenzt."
        )


def investitionen_laden(
    verbindung: sqlite3.Connection,
    objekt_id: int | None = None,
) -> list[sqlite3.Row]:
    """Lädt Investitionen, optional gefiltert auf ein Haus."""
    sql = (
        "SELECT i.id, i.objekt_id, i.datum, i.betrag, i.beschreibung, "
        "i.typ, i.nutzungsdauer, i.beleg_pfad, i.verteilung_jahre, "
        "o.name AS objekt_name "
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
    verteilung_jahre: int = 1,
) -> int:
    """Legt eine neue Investition an."""
    _pruefen(typ, betrag, nutzungsdauer, verteilung_jahre)
    cursor = verbindung.execute(
        "INSERT INTO investitionen "
        "(objekt_id, datum, betrag, beschreibung, typ, nutzungsdauer, "
        "beleg_pfad, verteilung_jahre) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (objekt_id, datum, str(betrag), beschreibung.strip(), typ,
         nutzungsdauer, beleg_pfad, verteilung_jahre),
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
    verteilung_jahre: int = 1,
) -> None:
    """Aktualisiert eine bestehende Investition."""
    _pruefen(typ, betrag, nutzungsdauer, verteilung_jahre)
    verbindung.execute(
        "UPDATE investitionen SET objekt_id = ?, datum = ?, betrag = ?, "
        "beschreibung = ?, typ = ?, nutzungsdauer = ?, beleg_pfad = ?, "
        "verteilung_jahre = ? WHERE id = ?",
        (objekt_id, datum, str(betrag), beschreibung.strip(), typ,
         nutzungsdauer, beleg_pfad, verteilung_jahre, investition_id),
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
    """Berechnet AfA und abzugsfähige Erhaltungsaufwendungen eines Jahres.

    Liefert ein Dict mit:
    * ``erhaltung``: Erhaltungsaufwand, der auf dieses Jahr entfällt
      (Sofortabzug oder Jahresanteil der § 82b-Verteilung)
    * ``afa``: Summe der AfA-Anteile aller Herstellungs-Investitionen
    * ``positionen``: Detail-Aufstellung für den Bericht
    """
    erhaltung = Decimal("0")
    afa_summe = Decimal("0")
    positionen: list[dict] = []
    for inv in investitionen_laden(verbindung, objekt_id):
        try:
            betrag = Decimal(inv["betrag"])
            beginn = date.fromisoformat(inv["datum"][:10])
        except (ValueError, TypeError, IndexError):
            continue
        if inv["typ"] == "erhaltung":
            jahre = int(inv["verteilung_jahre"] or 1)
            anteil = verteilung_82b(betrag, beginn.year, jahre).get(jahr)
            if anteil is None:
                continue
            erhaltung += anteil
            positionen.append({
                "id": inv["id"],
                "datum": inv["datum"],
                "beschreibung": inv["beschreibung"] or "",
                "typ": ("Erhaltung" if jahre == 1
                        else f"Erhaltung § 82b ({jahre} J.)"),
                "art": "erhaltung",
                "anteil": anteil,
                "gesamt": betrag,
                "beleg_pfad": inv["beleg_pfad"],
            })
            continue
        # Herstellungsaufwand → AfA linear über die Nutzungsdauer
        nutzungsdauer = int(inv["nutzungsdauer"] or 50)
        satz = Decimal(100) / Decimal(nutzungsdauer)
        anteil = lineare_afa_plan(betrag, beginn, satz).get(jahr)
        if anteil is None:
            continue
        afa_summe += anteil
        positionen.append({
            "id": inv["id"],
            "datum": inv["datum"],
            "beschreibung": inv["beschreibung"] or "",
            "typ": f"AfA {nutzungsdauer} J.",
            "art": "afa",
            "anteil": anteil,
            "gesamt": betrag,
            "beleg_pfad": inv["beleg_pfad"],
        })
    return {
        "erhaltung": erhaltung,
        "afa": afa_summe,
        "positionen": positionen,
    }
