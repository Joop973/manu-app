"""Eingabeverarbeitung: Beträge parsen/formatieren, Validierungsfehler.

Beträge werden intern als ``Decimal`` geführt, damit bei der
Nebenkostenabrechnung keine float-Rundungsfehler entstehen.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

# Zwei Nachkommastellen — Standardgenauigkeit für Geldbeträge.
_GENAUIGKEIT = Decimal("0.01")

# Monatsnamen (Index 0 = Januar) für Auswahlfelder und Tabellen.
MONATSNAMEN = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]
MONATSNAMEN_KURZ = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
]


class ValidierungsFehler(Exception):
    """Fehler bei der Prüfung von Benutzereingaben.

    Die Meldung ist für die direkte Anzeige in der GUI gedacht.
    """


def betrag_parsen(text: str) -> Decimal:
    """Wandelt eine Texteingabe in einen ``Decimal``-Betrag um.

    Akzeptiert deutsche Schreibweise (``1.250,50``) ebenso wie die
    Punkt-Schreibweise (``1250.50``). Wirft ``ValidierungsFehler`` bei
    ungültiger oder negativer Eingabe.
    """
    roh = text.strip().replace("€", "").replace(" ", "")
    if not roh:
        raise ValidierungsFehler("Bitte einen Betrag eingeben.")

    # Deutsche Schreibweise: Punkt = Tausender, Komma = Dezimaltrenner.
    if "." in roh and "," in roh:
        roh = roh.replace(".", "").replace(",", ".")
    elif "," in roh:
        roh = roh.replace(",", ".")

    try:
        wert = Decimal(roh)
    except InvalidOperation:
        raise ValidierungsFehler(f"„{text}“ ist keine gültige Zahl.") from None

    if wert < 0:
        raise ValidierungsFehler("Der Betrag darf nicht negativ sein.")
    return wert.quantize(_GENAUIGKEIT)


def betrag_mit_vorzeichen_parsen(text: str) -> Decimal:
    """Wie ``betrag_parsen``, erlaubt aber Vorzeichen.

    Akzeptiert ``-23,00``, ``23,00-``, ``23,00 S`` (Soll = Ausgang) und
    ``23,00 H`` (Haben = Eingang) — typische Schreibweisen in
    Bank-Exporten.
    """
    roh = (text or "").strip().replace("€", "").replace(" ", "")
    negativ = False
    if roh.upper().endswith("S"):
        negativ, roh = True, roh[:-1]
    elif roh.upper().endswith("H"):
        roh = roh[:-1]
    if roh.endswith("-"):
        negativ, roh = True, roh[:-1]
    if roh.startswith("-"):
        negativ, roh = not negativ, roh[1:]
    elif roh.startswith("+"):
        roh = roh[1:]
    wert = betrag_parsen(roh)
    return -wert if negativ else wert


def datum_iso_parsen(wert) -> str | None:
    """Wandelt ein Datum (date/datetime, ``TT.MM.JJJJ``, ``JJJJ-MM-TT``)
    in ISO-Text. Liefert ``None`` bei ungültiger Eingabe."""
    from datetime import date, datetime

    if wert is None:
        return None
    if isinstance(wert, datetime):
        return wert.date().isoformat()
    if isinstance(wert, date):
        return wert.isoformat()
    text = str(wert).strip()[:10]
    try:
        if "." in text:
            tag, monat, jahr = text.split(".")[:3]
            jahr = jahr.strip()
            if len(jahr) == 2:
                jahr = "20" + jahr
            return date(int(jahr), int(monat), int(tag)).isoformat()
        return date.fromisoformat(text).isoformat()
    except (ValueError, TypeError):
        return None


def betrag_formatieren(wert: Decimal | str | int) -> str:
    """Formatiert einen Betrag in deutscher Schreibweise (z. B. ``1.250,50``)."""
    betrag = Decimal(str(wert)).quantize(_GENAUIGKEIT)
    negativ = betrag < 0
    ganz, _, dezimal = f"{abs(betrag):.2f}".partition(".")

    gruppen = ""
    while len(ganz) > 3:
        gruppen = "." + ganz[-3:] + gruppen
        ganz = ganz[:-3]
    ergebnis = f"{ganz}{gruppen},{dezimal}"
    return f"-{ergebnis}" if negativ else ergebnis


def datum_anzeigen(iso_text: str | None) -> str:
    """Wandelt ein ISO-Datum (YYYY-MM-DD) in deutsche Anzeige (TT.MM.JJJJ)."""
    if not iso_text:
        return "—"
    try:
        jahr, monat, tag = iso_text.split("-")
        return f"{tag}.{monat}.{jahr}"
    except ValueError:
        return iso_text
