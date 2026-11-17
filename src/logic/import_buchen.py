"""Übernahme importierter Kontobewegungen in die Buchungstabelle.

Gemeinsamer Weg für Vollautomatik und Import-Vorschau:

1. **Vorzeichen:** Der Kontobetrag (+ Eingang / − Ausgang) wird in die
   Richtung der Kategorie umgerechnet. Ein Geldeingang auf einer
   Ausgabe-Kategorie (z. B. Gas-Guthaben des Versorgers) wird so zur
   Gegenbuchung und mindert die Kosten, statt sie zu erhöhen.
2. **Mietaufteilung:** Zahlt ein Mieter genau die vereinbarte Miete
   (oder ein Vielfaches davon), wird die Zahlung in Kaltmiete und
   Nebenkosten-Vorauszahlung aufgeteilt. Das ist nötig, weil die
   Anlage V beides getrennt verlangt und die Nebenkostenabrechnung die
   tatsächlich gezahlten Vorauszahlungen braucht. Weicht die Zahlung ab,
   bleibt sie ungeteilt und es wird ein Hinweis geliefert.
3. **Mietzahlungs-Checkliste:** Der bezahlte Monat wird abgehakt. Geht
   die Miete ab dem 25. ein, gilt sie als Miete des Folgemonats.
4. **Lernsystem:** Haus/Kategorie/Mieter werden als Muster gemerkt.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal

from src.db import buchungen, mietzahlungen, muster, stammdaten
from src.logic import lernsystem
from src.logic.steuer import betrag_fuer_kategorie, dezimal

_NULL = Decimal("0")
# Ab diesem Kalendertag gilt eine Mietzahlung als Vorauszahlung für den
# Folgemonat (Miete ist üblicherweise bis zum 3. Werktag fällig).
FOLGEMONAT_AB_TAG = 25

ANTEIL_KALT = " [Anteil Kaltmiete]"
ANTEIL_NK = " [Anteil Nebenkosten-Vorauszahlung]"


def _kategorie(verbindung: sqlite3.Connection, kategorie_id: int):
    return verbindung.execute(
        "SELECT id, typ, rolle, steuer_art FROM kategorien WHERE id = ?",
        (kategorie_id,),
    ).fetchone()


def leistungsmonat(datum: str) -> tuple[int, int]:
    """Monat, für den eine Mietzahlung vom ``datum`` vermutlich gilt."""
    tag = date.fromisoformat(datum[:10])
    if tag.day >= FOLGEMONAT_AB_TAG:
        if tag.month == 12:
            return tag.year + 1, 1
        return tag.year, tag.month + 1
    return tag.year, tag.month


def mietaufteilung(
    verbindung: sqlite3.Connection,
    kategorie_id: int,
    mieter_id: int | None,
    betrag: Decimal,
) -> tuple[list[tuple[int, Decimal, str]], int, str | None]:
    """Teilt eine Mietzahlung in Kaltmiete und Nebenkosten auf.

    Liefert ``(teile, monate, hinweis)``; ``teile`` ist eine Liste von
    ``(kategorie_id, betrag, text_zusatz)``. Ohne Aufteilung enthält
    sie genau den Originalposten.
    """
    ungeteilt = [(kategorie_id, betrag, "")]
    if mieter_id is None or betrag <= 0:
        return ungeteilt, 1, None
    kategorie = _kategorie(verbindung, kategorie_id)
    if kategorie is None or not (
        kategorie["rolle"] == "kaltmiete" or kategorie["steuer_art"] == "miete"
    ):
        return ungeteilt, 1, None
    mieter = verbindung.execute(
        "SELECT name, kaltmiete, nebenkosten, ruecklage FROM mieter "
        "WHERE id = ?",
        (mieter_id,),
    ).fetchone()
    if mieter is None:
        return ungeteilt, 1, None
    kalt = dezimal(mieter["kaltmiete"], _NULL)
    nk = dezimal(mieter["nebenkosten"], _NULL)
    ruecklage = dezimal(mieter["ruecklage"], _NULL)
    nk_kategorie = stammdaten.kategorie_nach_rolle(verbindung, "nebenkosten")
    if nk <= 0 or nk_kategorie is None:
        return ungeteilt, 1, None

    for soll in (kalt + nk, kalt + nk + ruecklage):
        if soll <= 0:
            continue
        for monate in range(1, 13):
            if betrag == soll * monate:
                nk_teil = nk * monate
                return [
                    (kategorie_id, betrag - nk_teil, ANTEIL_KALT),
                    (nk_kategorie, nk_teil, ANTEIL_NK),
                ], monate, None
    from src.utils.eingaben import betrag_formatieren

    return ungeteilt, 1, (
        f"Zahlung von {mieter['name']} ({betrag_formatieren(betrag)} €) "
        f"weicht von der vereinbarten Miete "
        f"({betrag_formatieren(kalt + nk)} € = Kalt "
        f"{betrag_formatieren(kalt)} + NK {betrag_formatieren(nk)}) ab und "
        "wurde vollständig als Kaltmiete gebucht. Bitte prüfen und ggf. "
        "in der Buchungsliste aufteilen."
    )


def kandidat_buchen(
    verbindung: sqlite3.Connection,
    kandidat: dict,
    objekt_id: int,
    kategorie_id: int,
    mieter_id: int | None,
    beleg_pfad: str | None = None,
    quelle: str = "import",
) -> tuple[list[int], str | None]:
    """Schreibt eine importierte Kontobewegung als Buchung(en).

    ``kandidat["betrag"]`` ist der Kontobetrag mit Vorzeichen. Liefert
    die IDs der angelegten Buchungen und ggf. einen Prüfhinweis.
    """
    kategorie = _kategorie(verbindung, kategorie_id)
    if kategorie is None:
        raise sqlite3.Error("Kategorie nicht gefunden.")
    gespeichert = betrag_fuer_kategorie(
        Decimal(kandidat["betrag"]), kategorie["typ"]
    )
    teile, monate, hinweis = mietaufteilung(
        verbindung, kategorie_id, mieter_id, gespeichert
    )
    ids: list[int] = []
    for teil_kategorie, teil_betrag, zusatz in teile:
        ids.append(buchungen.buchung_anlegen(
            verbindung, kandidat["datum"], teil_betrag, objekt_id,
            teil_kategorie, (kandidat.get("text") or "") + zusatz,
            beleg_pfad, quelle, mieter_id=mieter_id, commit=False,
        ))
    verbindung.commit()

    erkennung = lernsystem.erkennungstext_bilden(kandidat.get("norm", ""))
    if erkennung:
        muster.muster_speichern(
            verbindung, erkennung, objekt_id, kategorie_id,
            mieter_id=mieter_id,
        )

    if (mieter_id is not None and kategorie["typ"] == "einnahme"
            and gespeichert > 0 and kategorie["steuer_art"] != "neutral"):
        try:
            jahr, monat = leistungsmonat(kandidat["datum"])
        except ValueError:
            jahr = monat = None
        if jahr is not None:
            je_monat = (gespeichert / monate).quantize(Decimal("0.01"))
            for _ in range(monate):
                mietzahlungen.zahlung_vermerken(
                    verbindung, mieter_id, monat, jahr, je_monat
                )
                monat += 1
                if monat > 12:
                    monat, jahr = 1, jahr + 1
    return ids, hinweis
