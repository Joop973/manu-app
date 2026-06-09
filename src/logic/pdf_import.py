"""Auslesen von Bank-Kontoauszügen (PDF) mit pdfplumber.

Eine Buchung wird als **Block** mehrerer aufeinanderfolgender Zeilen
erkannt: Der Block beginnt, sobald eine Zeile mit einem deutschen Datum
beginnt, und endet bei der nächsten datums-eröffneten Zeile oder am
Ende des Auszugs. Innerhalb des Blocks werden Datum, Betrag und
Verwendungszweck eingesammelt. Saldo-Zeilen (Alter/Neuer Saldo,
Kontostand, Übertrag) werden bewusst übersprungen, da sie keine
Buchungen sind. Die endgültige Prüfung bleibt in der Import-Vorschau.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path
import re

# Deutsches Datum, z. B. 15.03.2024 oder 15.03.24 oder 15.03.
# Jahr ist optional, da Bankauszüge das Jahr in der Buchungszeile
# häufig weglassen (es steht im Auszugskopf).
_DATUM_RE = re.compile(r"(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)")

# Zeile, die *mit* einem Datum beginnt (Beginn eines Buchungsblocks).
_BLOCK_START_RE = re.compile(r"^\s*\d{1,2}\.\d{1,2}\.")

# Deutscher Geldbetrag mit optionalem Vorzeichen bzw. S/H-Kennung,
# z. B. -85,40  /  1.250,00 H  /  +650,00  /  85,40 S
_GELD_RE = re.compile(
    r"(?P<vz1>[+-]?)\s?"
    r"(?P<wert>\d{1,3}(?:\.\d{3})*,\d{2})"
    r"\s?(?P<vz2>[+-]|[HS])?"
)

# Zeilen, die *keine* Buchungen sind und übersprungen werden.
_SALDO_BEGRIFFE: tuple[str, ...] = (
    "alter saldo",
    "neuer saldo",
    "anfangssaldo",
    "endsaldo",
    "anfangsbestand",
    "endbestand",
    "kontostand",
    "übertrag",
    "uebertrag",
    "saldo der vorgängerseite",
    "saldo der vorseite",
    "zwischensumme",
    "summe soll",
    "summe haben",
)


def _datum_zu_iso(treffer: re.Match) -> str:
    """Wandelt einen Datums-Treffer in das ISO-Format YYYY-MM-DD."""
    tag, monat, jahr = treffer.group(1), treffer.group(2), treffer.group(3)
    if jahr is None:
        # Bei vielen Auszügen fehlt das Jahr in der Buchungszeile; in
        # diesem Fall lassen wir das aufrufende Modul ergänzen.
        jahr = "1900"
    elif len(jahr) == 2:
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


def _ist_saldo_zeile(zeile: str) -> bool:
    """Prüft, ob eine Zeile eine Saldo-/Bestandszeile ist."""
    klein = zeile.lower()
    return any(begriff in klein for begriff in _SALDO_BEGRIFFE)


def _jahr_aus_text(text: str) -> int | None:
    """Versucht, das Auszugsjahr (Header / Periode) zu erkennen."""
    # Bevorzugt eine Datumsangabe mit vierstelligem Jahr (z. B. 03/2026,
    # „Kontoauszug 2026" oder 31.03.2026).
    treffer = re.search(r"\b(20\d{2})\b", text)
    return int(treffer.group(1)) if treffer else None


def buchungszeilen_aus_text(text: str) -> list[dict]:
    """Extrahiert Buchungszeilen aus dem Rohtext eines Kontoauszugs.

    Liefert eine Liste von Dictionaries mit den Schlüsseln ``datum``
    (ISO), ``betrag`` (vorzeichenbehafteter Decimal) und ``text``
    (Empfänger / Verwendungszweck).
    """
    standardjahr = _jahr_aus_text(text)

    # 1) Auszug in Blöcke aufteilen — jeder Block beginnt mit einer
    #    Zeile, die mit einem Datum startet.
    bloecke: list[list[str]] = []
    aktuell: list[str] = []
    for rohzeile in text.splitlines():
        zeile = " ".join(rohzeile.split())
        if not zeile:
            continue
        if _ist_saldo_zeile(zeile):
            if aktuell:
                bloecke.append(aktuell)
                aktuell = []
            continue
        if _BLOCK_START_RE.match(zeile):
            if aktuell:
                bloecke.append(aktuell)
            aktuell = [zeile]
        elif aktuell:
            aktuell.append(zeile)
    if aktuell:
        bloecke.append(aktuell)

    # 2) Pro Block Datum, Betrag und Beschreibung herausarbeiten.
    ergebnis: list[dict] = []
    for block in bloecke:
        zusammen = " ".join(block)
        datum_treffer = _DATUM_RE.search(zusammen)
        if datum_treffer is None:
            continue
        geld_treffer = list(_GELD_RE.finditer(zusammen))
        if not geld_treffer:
            continue

        letzter = geld_treffer[-1]
        beschreibung = zusammen[: letzter.start()]
        beschreibung = _DATUM_RE.sub(" ", beschreibung)
        beschreibung = _GELD_RE.sub(" ", beschreibung)

        datum_iso = _datum_zu_iso(datum_treffer)
        if datum_iso.startswith("1900-") and standardjahr is not None:
            datum_iso = f"{standardjahr:04d}-{datum_iso[5:]}"

        ergebnis.append({
            "datum": datum_iso,
            "betrag": _geld_zu_decimal(letzter),
            "text": " ".join(beschreibung.split()),
        })
    return ergebnis


def rohtext_lesen(pdf_pfad: str | Path) -> str:
    """Liefert den reinen Textinhalt eines PDF (für Diagnosezwecke)."""
    import pdfplumber  # verzögerter Import, hält den App-Start schlank

    text_teile: list[str] = []
    with pdfplumber.open(str(pdf_pfad)) as pdf:
        for seite in pdf.pages:
            text_teile.append(seite.extract_text() or "")
    return "\n".join(text_teile)


def kontoauszug_einlesen(pdf_pfad: str | Path) -> list[dict]:
    """Liest einen Kontoauszug (PDF) und liefert die Buchungszeilen."""
    return buchungszeilen_aus_text(rohtext_lesen(pdf_pfad))
