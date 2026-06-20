"""Lernsystem für den Kontoauszug-Import.

Normalisiert Empfänger-/Verwendungszwecktexte und ordnet anhand
gespeicherter Buchungsmuster automatisch Haus und Kategorie zu.
"""

from __future__ import annotations

import re
import sqlite3
from decimal import Decimal

from src.db import buchungen, muster, regeln

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


# Stichwort-Heuristik: ordnet einer normalisierten Empfänger-Zeile eine
# Kategorie zu, *bevor* irgendetwas gelernt wurde. Wirkt nur, wenn keine
# Regel und kein Muster getroffen haben.
#
# Reihenfolge wichtig: spezifischere Stichwörter zuerst, damit z. B.
# „STADTWERKE" nicht ungewollt vor „WERKE" trifft.
_KATEGORIE_HEURISTIK: list[tuple[tuple[str, ...], str]] = [
    # Kontoabschluss / Bankgebühren
    (("ABSCHLUSS", "KONTOFUEHRUNG", "KONTOFÜHRUNG", "ENTGELT", "AUSLAGEN"),
     "Kontoabschluss"),
    # Steuern
    (("FINANZAMT", "LANDESHAUPTKASSE", "EINK ST", "STEUER", "FINANZKASSE"),
     "Finanzamt"),
    # Versicherungen
    (("HUK", "ALLIANZ", "BRANDKASSE", "VERSICHERUNG", "AXA", "PROVINZIAL",
      "DEVK", "GOTHAER", "ERGO", "DEBEKA", "GENERALI", "VHV", "ZURICH"),
     "Versicherung"),
    # Gemeinde / Grundsteuer
    (("GRUNDBESITZ", "GRUNDSTEUER", "GEMEINDE", "STADTKASSE"),
     "Gemeinde/Grundbesitz"),
    # Abfall / Müll
    (("ABFALLWIRTSCHAFT", "ABFALL", "MUELL", "MÜLL", "AWB"),
     "Müll"),
    # Schornstein
    (("SCHORNSTEINFEGER", "KAMINKEHRER"),
     "Schornsteinfeger"),
    # Wasser
    (("WASSERWERK", "WASSERVERBAND", "STADTENTWAESSERUNG", "ABWASSER"),
     "Wasser"),
    # Energie
    (("STADTWERKE",),
     "Gas"),  # Default Gas; nutzer kann auf Strom umstellen
    (("STROM", "ENERGIE", "ELEKTRIZITAET"),
     "Strom"),
    (("GAS", "ERDGAS"),
     "Gas"),
    # Medien / Telefon
    (("VODAFONE", "TELEKOM", "1UND1", "1&1", "O2", "TELEFONICA"),
     "Vodafone"),
    (("GEZ", "RUNDFUNK", "ARD ZDF", "ARDZDF", "BEITRAGSSERVICE"),
     "GEZ"),
    # Erbpacht
    (("ERBPACHT", "ERBBAUZINS"),
     "Erbpacht"),
]


def _heuristik_kategorie_id(
    verbindung: sqlite3.Connection, normalisiert: str
) -> int | None:
    """Sucht eine Kategorie über Stichwörter im normalisierten Text."""
    for stichworte, kategorie_name in _KATEGORIE_HEURISTIK:
        if any(s in normalisiert for s in stichworte):
            zeile = verbindung.execute(
                "SELECT id FROM kategorien WHERE name = ? AND typ = 'ausgabe' "
                "AND aktiv = 1",
                (kategorie_name,),
            ).fetchone()
            if zeile is not None:
                return zeile["id"]
    return None


def klassifizieren(
    verbindung: sqlite3.Connection, datum: str, betrag: Decimal, text: str
) -> dict:
    """Klassifiziert eine importierte Buchungszeile.

    Liefert einen Kandidaten mit Status:
    * ``auto``     — sicher per Regel oder Muster zugeordnet
    * ``unsicher`` — Treffer mit auffälliger Betragsabweichung
    * ``neu``      — keine Vor-Zuordnung möglich (Haus fehlt)
    """
    normalisiert = normalisieren(text)
    kandidat = {
        "datum": datum,
        "betrag": betrag,
        "text": text,
        "norm": normalisiert,
        "objekt_id": None,
        "kategorie_id": None,
        "mieter_id": None,
        "status": "neu",
        "dublette": buchungen.buchung_existiert(verbindung, datum, betrag),
    }

    # 1) Benutzerdefinierte Regel hat Vorrang.
    regel = regeln.regel_finden(verbindung, normalisiert)
    if regel is not None:
        kandidat["objekt_id"] = regel["objekt_id"]
        kandidat["kategorie_id"] = regel["kategorie_id"]
        kandidat["mieter_id"] = regel["mieter_id"]
        if regel["objekt_id"] and regel["kategorie_id"]:
            kandidat["status"] = "auto"

    # 2) Gelerntes Muster ergänzt, was die Regel offen lässt.
    treffer = muster.muster_finden(verbindung, normalisiert)
    if treffer is not None:
        if kandidat["objekt_id"] is None:
            kandidat["objekt_id"] = treffer["objekt_id"]
        if kandidat["kategorie_id"] is None:
            kandidat["kategorie_id"] = treffer["kategorie_id"]
        if kandidat["mieter_id"] is None:
            kandidat["mieter_id"] = treffer["mieter_id"]
        if kandidat["objekt_id"] and kandidat["kategorie_id"]:
            kandidat["status"] = "auto"

        # Betragsabweichung gegenüber dem Durchschnitt ähnlicher Buchungen.
        schnitt = _durchschnitt_fuer_muster(
            verbindung, treffer["erkennungstext"]
        )
        if schnitt and schnitt > 0:
            abweichung = abs(abs(betrag) - schnitt) / schnitt
            if abweichung > ABWEICHUNG_GRENZE:
                kandidat["status"] = "unsicher"

    # 3) Stichwort-Heuristik schlägt eine Kategorie auch ohne Lernkurve vor.
    if kandidat["kategorie_id"] is None and betrag < 0:
        vorschlag = _heuristik_kategorie_id(verbindung, normalisiert)
        if vorschlag is not None:
            kandidat["kategorie_id"] = vorschlag
            # Markiere als Vorschlag — Haus fehlt noch, bleibt also "neu",
            # aber die Kategorie ist bereits vorausgewählt.
    return kandidat
