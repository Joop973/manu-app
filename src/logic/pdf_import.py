"""Auslesen von Bank-Kontoauszügen (PDF) mit pdfplumber.

Aktuell auf das Format der **Emsländischen Volksbank eG** zugeschnitten;
weitere Banken können später als zusätzliche „Profile" ergänzt werden.

Aufbau einer Volksbank-Buchungstabelle::

    Bu-Tag  Wert    Vorgang                              Betrag  H/S
    02.03.  02.03.  Dauerauftragsgutschr              4.000,00   H
            (Folgezeilen — Empfänger / Verwendungszweck)

Eine Buchung beginnt **immer** am Zeilenanfang mit ``DD.MM.``. Der
Betrag steht am Ende dieser Startzeile, gefolgt von ``H`` (Haben /
Gutschrift) oder ``S`` (Soll / Belastung). Folgezeilen ohne führendes
Datum sind Bestandteil des Verwendungszwecks.

Salden-, Übertrags- und Abrechnungs-Rahmenzeilen werden gezielt
übersprungen; Beträge und Datumsangaben innerhalb des Verwendungs-
zwecks dürfen den Buchungsbetrag nicht überschreiben.

Plausibilitätsprüfung
---------------------
``saldo_pruefen()`` rechnet aus erkannten Buchungen, Anfangssaldo
und Endsaldo, ob die Summe stimmt. Wird die Prüfung am erkannten
Endsaldo bestätigt, ist das Ergebnis nachweislich vollständig.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re

# ---------------------------------------------------------------------------
# Regexe — bewusst eng formuliert, damit Verwendungszweck-Inhalte (Codes,
# Beträge, Referenzdaten) nicht als neue Buchung interpretiert werden.
# ---------------------------------------------------------------------------

# Buchungs-Startzeile: ``Bu-Tag [Wert] Vorgang ... Betrag H|S``
_BUCHUNG_START_RE = re.compile(
    r"^\s*(?P<bu_tag>\d{1,2})\.(?P<bu_monat>\d{1,2})\.\s+"
    r"(?:\d{1,2}\.\d{1,2}\.\s+)?"
    r"(?P<vorgang>.+?)\s+"
    r"(?P<betrag>\d{1,3}(?:\.\d{3})*,\d{2})\s*(?P<sh>[HS])\s*$"
)

# Saldo-, Übertrags- und Rahmenzeilen, die niemals Buchungen sind.
_NICHT_BUCHUNG_RE = re.compile(
    r"^\s*("
    r"alter\s+Kontostand|neuer\s+Kontostand|"
    r"Übertrag\s+(auf|von)\s+Blatt|"
    r"Bu-Tag\s+Wert\s+Vorgang|"
    r"Abschluss\s+vom"
    r")",
    re.IGNORECASE,
)

# Ab hier folgt der juristische Boilerplate-Text auf der letzten Seite.
_FOOTER_START_RE = re.compile(
    r"^\s*Sehr\s+geehrte\s+(Kundin|Kunde)", re.IGNORECASE
)

# Auszugsnummer "Kontoauszug Nr. 3/2026" — präzise Jahresquelle.
_AUSZUG_JAHR_RE = re.compile(r"Kontoauszug\s+Nr\.\s*\d+\s*/\s*(\d{4})")

# Vollständige Auszugs-Kennung (Nummer + Jahr) für den Dubletten-Schutz.
_AUSZUG_NR_RE = re.compile(r"Kontoauszug\s+Nr\.\s*(\d+)\s*/\s*(\d{4})")

# Kontonummer bzw. IBAN aus dem Auszugskopf — unterscheidet die Konten,
# denn jedes Konto zählt seine Auszüge selbst ("Nr. 3/2026" gibt es je
# Konto einmal).
_KONTO_RE = re.compile(r"Kontonummer\s+(\d{4,})")
_IBAN_RE = re.compile(r"IBAN:?\s*([A-Z]{2}[0-9][0-9 ]{12,})")


def konto_nummer(text: str) -> str | None:
    """Liest die Kontonummer (bzw. IBAN) aus dem Auszugskopf."""
    konto = _KONTO_RE.search(text)
    if konto:
        return konto.group(1)
    iban = _IBAN_RE.search(text)
    if iban:
        return iban.group(1).replace(" ", "")
    return None


def auszug_kennung(text: str) -> str | None:
    """Liest die eindeutige Auszugs-Kennung aus dem Kopf des Auszugs.

    Format: ``<kontonummer>|<nr>/<jahr>`` (z. B. ``324779100|3/2026``),
    damit sich Auszüge verschiedener Konten mit gleicher laufender
    Nummer nicht gegenseitig als Dublette blockieren. Ohne erkennbare
    Kontonummer/IBAN fällt die Kennung auf ``<nr>/<jahr>`` zurück.
    """
    treffer = _AUSZUG_NR_RE.search(text)
    if treffer is None:
        return None
    nummer = f"{int(treffer.group(1))}/{treffer.group(2)}"
    konto = _KONTO_RE.search(text)
    if konto:
        return f"{konto.group(1)}|{nummer}"
    iban = _IBAN_RE.search(text)
    if iban:
        return f"{iban.group(1).replace(' ', '')}|{nummer}"
    return nummer

# Saldo-Zeilen für die Plausibilitätsprüfung.
_SALDO_RE = re.compile(
    r"^\s*(alter|neuer)\s+Kontostand\s+vom\s+\d{1,2}\.\d{1,2}\.\d{4}\s+"
    r"(?P<betrag>\d{1,3}(?:\.\d{3})*,\d{2})\s+(?P<sh>[HS])",
    re.IGNORECASE,
)


def _betrag_zu_decimal(text: str, sh: str | None = None) -> Decimal:
    """Wandelt einen deutschen Geldtext in einen Decimal."""
    try:
        wert = Decimal(text.replace(".", "").replace(",", "."))
    except InvalidOperation:
        return Decimal("0")
    if sh == "S":
        wert = -wert
    return wert


def _auszugsjahr(text: str) -> int | None:
    """Liest das Auszugsjahr aus dem Header (``Kontoauszug Nr. N/JJJJ``)."""
    treffer = _AUSZUG_JAHR_RE.search(text)
    if treffer:
        return int(treffer.group(1))
    # Notfall-Fallback: erstes Jahr in der Form 20xx im Anfang des Textes.
    ersatz = re.search(r"\b(20\d{2})\b", text[:2000])
    return int(ersatz.group(1)) if ersatz else None


# Datum der Saldo-Zeilen ("alter/neuer Kontostand vom 31.12.2025").
_SALDO_DATUM_RE = re.compile(
    r"(alter|neuer)\s+Kontostand\s+vom\s+(\d{1,2})\.(\d{1,2})\.(\d{4})",
    re.IGNORECASE,
)


def auszug_zeitraum(text: str) -> tuple[date | None, date | None]:
    """Liest Beginn (alter Kontostand) und Ende (neuer Kontostand) des Auszugs."""
    von = bis = None
    for treffer in _SALDO_DATUM_RE.finditer(text):
        try:
            datum = date(int(treffer.group(4)), int(treffer.group(3)),
                         int(treffer.group(2)))
        except ValueError:
            continue
        if treffer.group(1).lower() == "alter" and von is None:
            von = datum
        elif treffer.group(1).lower() == "neuer":
            bis = datum
    return von, bis


def _jahr_fuer_buchung(
    tag: int, monat: int, von: date | None, bis: date | None,
    auszugsjahr: int | None, monate_im_auszug: set[int],
) -> int:
    """Bestimmt das Jahr einer Buchung, die nur als ``TT.MM.`` vorliegt.

    Der Januar-Auszug enthält häufig noch Buchungen vom Dezember des
    Vorjahres. Maßgeblich ist daher der Auszugszeitraum (alter bis neuer
    Kontostand): gewählt wird das Jahr, in dem das Datum in diesen
    Zeitraum fällt. Ohne Zeitraum gilt: Dezember-Buchungen in einem
    Auszug, der auch Januar-Buchungen enthält, gehören ins Vorjahr.
    """
    if bis is not None:
        for jahr in (bis.year, bis.year - 1, bis.year + 1):
            try:
                kandidat = date(jahr, monat, tag)
            except ValueError:
                continue
            untere = von if von is not None else date(bis.year - 1, bis.month,
                                                       1)
            if untere <= kandidat <= bis:
                return jahr
        # Datum liegt (leicht) außerhalb: nächstliegendes Jahr ≤ Ende.
        try:
            return bis.year if date(bis.year, monat, tag) <= bis else bis.year - 1
        except ValueError:
            return bis.year
    jahr = auszugsjahr if auszugsjahr is not None else 1900
    if monat == 12 and 1 in monate_im_auszug:
        return jahr - 1
    return jahr


def buchungszeilen_aus_text(text: str) -> list[dict]:
    """Extrahiert Buchungen aus dem Rohtext eines Volksbank-Auszugs.

    Liefert eine Liste von Dictionaries mit ``datum`` (ISO),
    ``betrag`` (vorzeichenbehafteter Decimal: + Eingang, − Ausgang) und
    ``text`` (Vorgang + Verwendungszweck).
    """
    jahr = _auszugsjahr(text)
    von, bis = auszug_zeitraum(text)
    buchungen: list[dict] = []
    aktuell: dict | None = None

    for rohzeile in text.splitlines():
        zeile = " ".join(rohzeile.split())
        if not zeile:
            continue

        # Boilerplate-Footer erreicht — fertig.
        if _FOOTER_START_RE.match(zeile):
            break

        # Saldo / Übertrag / Tabellenkopf / Abschluss-Rahmen → kein Anhängen.
        if _NICHT_BUCHUNG_RE.match(zeile):
            if aktuell is not None:
                buchungen.append(aktuell)
                aktuell = None
            continue

        treffer = _BUCHUNG_START_RE.match(zeile)
        if treffer:
            if aktuell is not None:
                buchungen.append(aktuell)
            tag = int(treffer.group("bu_tag"))
            monat = int(treffer.group("bu_monat"))
            aktuell = {
                "_tag": tag,
                "_monat": monat,
                "betrag": _betrag_zu_decimal(
                    treffer.group("betrag"), treffer.group("sh")
                ),
                "text": treffer.group("vorgang").strip(),
            }
            continue

        # Folgezeile zum laufenden Verwendungszweck.
        if aktuell is not None:
            aktuell["text"] = (aktuell["text"] + " " + zeile).strip()

    if aktuell is not None:
        buchungen.append(aktuell)

    monate = {b["_monat"] for b in buchungen}
    for buchung in buchungen:
        tag = buchung.pop("_tag")
        monat = buchung.pop("_monat")
        jahr_eff = _jahr_fuer_buchung(tag, monat, von, bis, jahr, monate)
        buchung["datum"] = f"{jahr_eff:04d}-{monat:02d}-{tag:02d}"
    # Reihenfolge der Schlüssel wie bisher (datum, betrag, text).
    return [
        {"datum": b["datum"], "betrag": b["betrag"], "text": b["text"]}
        for b in buchungen
    ]


def saldo_pruefen(text: str, buchungen: list[dict]) -> dict:
    """Vergleicht Anfangs- + Σ(Buchungen) mit dem Endsaldo des Auszugs.

    Liefert ein Dict mit ``alter`` und ``neuer`` Saldo, der berechneten
    Endsumme und einem ``stimmt``-Flag (Differenz ≤ 1 Cent).
    """
    salden: list[tuple[str, Decimal]] = []
    for zeile in text.splitlines():
        treffer = _SALDO_RE.match(" ".join(zeile.split()))
        if treffer:
            wer = "alter" if "alter" in treffer.group(0).lower() else "neuer"
            salden.append((wer, _betrag_zu_decimal(
                treffer.group("betrag"), treffer.group("sh")
            )))
    alter = next((b for w, b in salden if w == "alter"), None)
    neuer = next((b for w, b in salden if w == "neuer"), None)
    summe = sum((b["betrag"] for b in buchungen), Decimal("0"))
    berechnet = (alter + summe) if alter is not None else None
    stimmt = (
        neuer is not None
        and berechnet is not None
        and abs(berechnet - neuer) <= Decimal("0.01")
    )
    return {
        "alter_saldo": alter,
        "neuer_saldo": neuer,
        "summe_buchungen": summe,
        "berechneter_endsaldo": berechnet,
        "stimmt": stimmt,
    }


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
