"""Lernsystem für den Kontoauszug-Import.

Normalisiert Empfänger-/Verwendungszwecktexte und ordnet anhand
gespeicherter Buchungsmuster automatisch Haus und Kategorie zu.
"""

from __future__ import annotations

import re
import sqlite3
from decimal import Decimal

from src.db import muster

# Maximale Länge des gespeicherten Erkennungstextes.
_ERKENNUNG_LAENGE = 40
# Ab dieser relativen Betragsabweichung gilt ein Treffer als unsicher.
ABWEICHUNG_GRENZE = Decimal("0.30")

# Rechtsformen, die beim Normalisieren entfernt werden (längste zuerst).
_RECHTSFORMEN = [
    "GMBH & CO. KG", "GMBH & CO KG", "GMBH", "MBH", "UG", "AG",
    "KG", "OHG", "GBR", "SE", "E.K.", "E. K.",
]

# Schlüsselwörter, nach denen Referenz-/Rechnungsnummern folgen.
_REFERENZ = re.compile(
    r"\b(RECHNUNG|RECHNUNGS-?NR|RG|RE|NR|REF|REFERENZ|KD|KUNDE|"
    r"KUNDEN-?NR|VERTRAG|VERTRAGS-?NR|BELEG|MANDAT)\b\.?\s*:?\s*\S*\d\S*",
    re.IGNORECASE,
)


def normalisieren(text: str) -> str:
    """Normalisiert einen Empfängertext für den Mustervergleich.

    Entfernt Datumsangaben, Referenz-/Rechnungsnummern, lange Ziffern-
    folgen und Rechtsformen, vereinheitlicht Groß-/Kleinschreibung und
    Leerzeichen.
    """
    if not text:
        return ""
    bearbeitet = text.upper()
    # Datumsangaben entfernen
    bearbeitet = re.sub(r"\b\d{1,2}\.\d{1,2}\.\d{2,4}\b", " ", bearbeitet)
    # Referenz- und Rechnungsnummern entfernen
    bearbeitet = _REFERENZ.sub(" ", bearbeitet)
    # Lange Ziffernfolgen (IBAN-Reste, Nummern) entfernen
    bearbeitet = re.sub(r"\b[A-Z]{0,2}\d[\d ]{4,}\d\b", " ", bearbeitet)
    bearbeitet = re.sub(r"\b\d{4,}\b", " ", bearbeitet)
    # Rechtsformen entfernen
    for rechtsform in _RECHTSFORMEN:
        bearbeitet = bearbeitet.replace(rechtsform, " ")
    # Nur Buchstaben und Leerzeichen behalten
    bearbeitet = re.sub(r"[^A-ZÄÖÜß ]", " ", bearbeitet)
    # Mehrfach-Leerzeichen zusammenfassen
    return re.sub(r"\s+", " ", bearbeitet).strip()


def erkennungstext_bilden(normalisierter_text: str) -> str:
    """Bildet aus dem normalisierten Text einen kompakten Erkennungstext.

    Verwendet den Anfang des Textes (dort steht meist der Empfänger) und
    schneidet an einer Wortgrenze ab.
    """
    if len(normalisierter_text) <= _ERKENNUNG_LAENGE:
        return normalisierter_text
    kurz = normalisierter_text[:_ERKENNUNG_LAENGE]
    if " " in kurz:
        kurz = kurz.rsplit(" ", 1)[0]
    return kurz


def _durchschnitt_fuer_muster(
    verbindung: sqlite3.Connection, erkennungstext: str
) -> Decimal | None:
    """Mittelt die Beträge bisheriger Buchungen desselben Musters.

    Eine Buchung zählt als „ähnlich", wenn der Erkennungstext im
    normalisierten Verwendungszweck enthalten ist.
    """
    if not erkennungstext:
        return None
    zeilen = verbindung.execute(
        "SELECT betrag, beschreibung FROM buchungen"
    ).fetchall()
    betraege = []
    for zeile in zeilen:
        if not zeile["beschreibung"]:
            continue
        if erkennungstext in normalisieren(zeile["beschreibung"]):
            try:
                betraege.append(abs(Decimal(zeile["betrag"])))
            except (ValueError, TypeError):
                continue
    if not betraege:
        return None
    return sum(betraege, Decimal("0")) / Decimal(len(betraege))


def klassifizieren(
    verbindung: sqlite3.Connection, datum: str, betrag: Decimal, text: str
) -> dict:
    """Klassifiziert eine importierte Buchungszeile.

    Liefert einen Kandidaten mit Status:
    * ``auto``     — sicher per Muster zugeordnet
    * ``unsicher`` — per Muster zugeordnet, aber auffällige Betragsabweichung
    * ``neu``      — kein Muster gefunden, Zuordnung erforderlich
    """
    normalisiert = normalisieren(text)
    kandidat = {
        "datum": datum,
        "betrag": betrag,
        "text": text,
        "norm": normalisiert,
        "objekt_id": None,
        "kategorie_id": None,
        "status": "neu",
    }

    treffer = muster.muster_finden(verbindung, normalisiert)
    if treffer is None:
        return kandidat

    kandidat["objekt_id"] = treffer["objekt_id"]
    kandidat["kategorie_id"] = treffer["kategorie_id"]
    kandidat["status"] = "auto"

    # Betragsabweichung gegenüber dem Durchschnitt ähnlicher Buchungen.
    schnitt = _durchschnitt_fuer_muster(verbindung, treffer["erkennungstext"])
    if schnitt and schnitt > 0:
        abweichung = abs(abs(betrag) - schnitt) / schnitt
        if abweichung > ABWEICHUNG_GRENZE:
            kandidat["status"] = "unsicher"
    return kandidat
