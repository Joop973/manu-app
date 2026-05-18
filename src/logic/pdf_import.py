"""Auslesen von Volksbank-Kontoauszügen (PDF) mit pdfplumber.

Das PDF wird nur gelesen, nicht gespeichert. Die Texterkennung ist
heuristisch ausgelegt: Eine Buchungszeile wird an einem Datum und einem
Geldbetrag erkannt; Folgezeilen ohne Datum erweitern den Verwendungs-
zweck. Da Kontoauszug-Layouts variieren, prüft der Nutzer die Ergebnisse
anschließend in der Import-Vorschau.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path
import re

# Deutsches Datum, z. B. 15.03.2024 oder 15.03.24
_DATUM_RE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b")

# Deutscher Geldbetrag mit optionalem Vorzeichen bzw. S/H-Kennung,
# z. B. -85,40  /  1.250,00 H  /  +650,00
_GELD_RE = re.compile(
    r"(?P<vz1>[+-]?)\s?"
    r"(?P<wert>\d{1,3}(?:\.\d{3})*,\d{2})"
    r"\s?(?P<vz2>[+-]|[HS])?"
)


def _datum_zu_iso(treffer: re.Match) -> str:
    """Wandelt einen Datums-Treffer in das ISO-Format YYYY-MM-DD."""
    tag, monat, jahr = treffer.group(1), treffer.group(2), treffer.group(3)
    if len(jahr) == 2:
        jahr = "20" + jahr
    return f"{int(jahr):04d}-{int(monat):02d}-{int(tag):02d}"


def _geld_zu_decimal(treffer: re.Match) -> Decimal:
    """Wandelt einen Geld-Treffer in einen vorzeichenbehafteten Decimal."""
    wert = treffer.group("wert").replace(".", "").replace(",", ".")
    try:
        betrag = Decimal(wert)
    except InvalidOperation:
        return Decimal("0")
    negativ = treffer.group("vz1") == "-" or treffer.group("vz2") in ("-", "S")
    return -betrag if negativ else betrag


def buchungszeilen_aus_text(text: str) -> list[dict]:
    """Extrahiert Buchungszeilen aus dem Rohtext eines Kontoauszugs.

    Liefert eine Liste von Dictionaries mit den Schlüsseln ``datum``
    (ISO), ``betrag`` (vorzeichenbehafteter Decimal) und ``text``
    (Empfänger / Verwendungszweck).
    """
    ergebnis: list[dict] = []
    aktuell: dict | None = None

    for rohzeile in text.splitlines():
        zeile = " ".join(rohzeile.split())
        if not zeile:
            continue

        datum_treffer = _DATUM_RE.search(zeile)
        geld_treffer = list(_GELD_RE.finditer(zeile))

        if datum_treffer and geld_treffer:
            # Beginn einer neuen Buchungszeile.
            if aktuell is not None:
                ergebnis.append(aktuell)
            letzter = geld_treffer[-1]
            beschreibung = zeile[:letzter.start()]
            beschreibung = _DATUM_RE.sub(" ", beschreibung, count=1)
            aktuell = {
                "datum": _datum_zu_iso(datum_treffer),
                "betrag": _geld_zu_decimal(letzter),
                "text": " ".join(beschreibung.split()),
            }
        elif aktuell is not None and not datum_treffer and not geld_treffer:
            # Folgezeile: Verwendungszweck erweitern.
            aktuell["text"] = f"{aktuell['text']} {zeile}".strip()

    if aktuell is not None:
        ergebnis.append(aktuell)
    return ergebnis


def kontoauszug_einlesen(pdf_pfad: str | Path) -> list[dict]:
    """Liest einen Kontoauszug (PDF) und liefert die Buchungszeilen."""
    import pdfplumber  # verzögerter Import, hält den App-Start schlank

    text_teile: list[str] = []
    with pdfplumber.open(str(pdf_pfad)) as pdf:
        for seite in pdf.pages:
            text_teile.append(seite.extract_text() or "")
    return buchungszeilen_aus_text("\n".join(text_teile))
