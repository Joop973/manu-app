"""Volltext-Erkennung und Auto-Zuordnung für archivierte Belege.

Für digitale PDF-Belege liest die App den eingebetteten Text direkt
mit pdfplumber. Bei eingescannten Belegen (Bild oder Bild-PDF) wird
optional ``pytesseract`` für die OCR herangezogen — die App läuft auch
ohne Tesseract, OCR fällt dann still aus.

Der extrahierte Text landet in der Tabelle ``beleg_texte`` und steht
über die Volltextsuche zur Verfügung. Außerdem wird er für das
Auto-Matching von Belegen zu bereits erfassten Buchungen verwendet.
"""

from __future__ import annotations

import re
import sqlite3
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from src.utils.paths import belege_verzeichnis


def belege_basis() -> Path:
    """Verzeichnis, in dem die archivierten Belege liegen."""
    return belege_verzeichnis()


_BILDFORMATE = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
# Geldbeträge in deutscher Schreibweise (1.234,56) im Belegtext.
_GELD_RE = re.compile(r"\b(\d{1,3}(?:\.\d{3})*,\d{2})\b")
_DATUM_DE_RE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b")
_DATUM_ISO_RE = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")


def text_aus_datei(pfad: Path) -> str:
    """Liest den Volltext einer Belegdatei (PDF oder Bild)."""
    suffix = pfad.suffix.lower()
    if suffix == ".pdf":
        return _pdf_text(pfad)
    if suffix in _BILDFORMATE:
        return _ocr_text(pfad)
    if suffix in (".txt", ".md"):
        try:
            return pfad.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
    return ""


def _pdf_text(pfad: Path) -> str:
    """Extrahiert den eingebetteten Text einer PDF (ohne OCR)."""
    try:
        import pdfplumber  # verzögerter Import
        with pdfplumber.open(str(pfad)) as pdf:
            return "\n".join(seite.extract_text() or "" for seite in pdf.pages)
    except Exception:  # noqa: BLE001 - Diagnose ist hier wichtiger als Strenge
        return ""


def _ocr_text(pfad: Path) -> str:
    """Liest Text aus einer Bilddatei per OCR (falls Tesseract installiert)."""
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        return ""
    try:
        return pytesseract.image_to_string(
            Image.open(str(pfad)), lang="deu"
        )
    except Exception:  # noqa: BLE001
        return ""


def beleg_text_aktualisieren(
    verbindung: sqlite3.Connection, relativer_pfad: str
) -> str:
    """Liest die Belegdatei und speichert den Volltext in der DB."""
    absoluter_pfad = belege_basis() / relativer_pfad
    if not absoluter_pfad.is_file():
        return ""
    text = text_aus_datei(absoluter_pfad)
    verbindung.execute(
        "INSERT INTO beleg_texte (beleg_pfad, text, erstellt_am) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(beleg_pfad) DO UPDATE SET "
        "text = excluded.text, erstellt_am = excluded.erstellt_am",
        (relativer_pfad, text, datetime.now().isoformat(timespec="seconds")),
    )
    verbindung.commit()
    return text


def beleg_text_suchen(
    verbindung: sqlite3.Connection, suchtext: str
) -> list[str]:
    """Liefert alle Beleg-Pfade, deren Volltext den Suchtext enthält."""
    if not suchtext:
        return []
    like = f"%{suchtext.strip().lower()}%"
    zeilen = verbindung.execute(
        "SELECT beleg_pfad FROM beleg_texte "
        "WHERE LOWER(IFNULL(text, '')) LIKE ?",
        (like,),
    ).fetchall()
    return [z["beleg_pfad"] for z in zeilen]


# ---------------------------------------------------------------------------
# Auto-Matching: Belegdateien aus einem Ordner Buchungen ohne Beleg zuordnen
# ---------------------------------------------------------------------------


def _datum_aus_text(text: str) -> str | None:
    """Sucht das erste plausible Datum (ISO oder DE) im Belegtext."""
    treffer = _DATUM_DE_RE.search(text)
    if treffer:
        tag, monat, jahr = treffer.group(1), treffer.group(2), treffer.group(3)
        if len(jahr) == 2:
            jahr = "20" + jahr
        try:
            return date(int(jahr), int(monat), int(tag)).isoformat()
        except ValueError:
            return None
    treffer = _DATUM_ISO_RE.search(text)
    if treffer:
        try:
            return date(
                int(treffer.group(1)),
                int(treffer.group(2)),
                int(treffer.group(3)),
            ).isoformat()
        except ValueError:
            return None
    return None


def _betraege_aus_text(text: str) -> list[Decimal]:
    """Extrahiert alle plausiblen Geldbeträge aus dem Belegtext."""
    werte: list[Decimal] = []
    for treffer in _GELD_RE.finditer(text):
        try:
            werte.append(
                Decimal(treffer.group(1).replace(".", "").replace(",", "."))
            )
        except InvalidOperation:
            continue
    return werte


def match_kandidaten(
    verbindung: sqlite3.Connection, belege_ordner: Path
) -> list[dict]:
    """Sucht zu jeder Belegdatei eine passende Buchung (ohne Beleg).

    Liefert je gefundenes Paar ein Dict mit ``buchung_id``, ``datei_pfad``,
    ``betrag``, ``buchungstext``, ``score``. Vergleich anhand Betrag
    (exakter Match mit ±1 Cent) und Datum (Buchungsdatum innerhalb von
    ±10 Tagen zum Belegdatum bevorzugt).
    """
    if not belege_ordner.is_dir():
        return []
    offene = verbindung.execute(
        "SELECT id, datum, betrag, beschreibung FROM buchungen "
        "WHERE beleg_pfad IS NULL OR beleg_pfad = ''"
    ).fetchall()
    paare: list[dict] = []
    for datei in belege_ordner.iterdir():
        if not datei.is_file() or datei.suffix.lower() not in (
            ".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"
        ):
            continue
        text = text_aus_datei(datei)
        betraege = _betraege_aus_text(text)
        beleg_datum = _datum_aus_text(text)
        bester: dict | None = None
        for buchung in offene:
            try:
                buchungs_betrag = abs(Decimal(buchung["betrag"]))
            except (ValueError, TypeError):
                continue
            if not any(abs(b - buchungs_betrag) <= Decimal("0.01")
                       for b in betraege):
                continue
            score = 50
            if beleg_datum and buchung["datum"]:
                try:
                    delta = abs(
                        date.fromisoformat(buchung["datum"]).toordinal()
                        - date.fromisoformat(beleg_datum).toordinal()
                    )
                    if delta <= 10:
                        score += 50 - delta
                except ValueError:
                    pass
            if bester is None or score > bester["score"]:
                bester = {
                    "buchung_id": buchung["id"],
                    "datei_pfad": str(datei),
                    "betrag": buchungs_betrag,
                    "buchungstext": buchung["beschreibung"] or "",
                    "score": score,
                }
        if bester is not None:
            paare.append(bester)
    return paare
