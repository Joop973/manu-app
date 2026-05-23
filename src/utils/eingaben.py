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
