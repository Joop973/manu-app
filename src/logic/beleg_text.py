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


_BILDFORMATE = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp",
                ".heic", ".heif"}
BELEG_ENDUNGEN = _BILDFORMATE | {".pdf"}
# Geldbeträge in deutscher Schreibweise (1.234,56 / 1234,56 / 12,50) im
# Belegtext; OCR liefert gelegentlich Leerzeichen als Tausendertrenner.
_GELD_RE = re.compile(
    r"(?<![\d,.])(\d{1,3}(?:[.\u00a0 ]\d{3})+|\d+),(\d{2})(?![\d,])"
)
_DATUM_DE_RE = re.compile(r"\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})\b")
_DATUM_ISO_RE = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
# Schlüsselwörter, hinter denen auf Rechnungen/Quittungen der zu
# zahlende Gesamtbetrag steht (Reihenfolge = Priorität).
_GESAMT_WOERTER = (
    "zu zahlen", "zahlbetrag", "rechnungsbetrag", "endbetrag",
    "gesamtbetrag", "gesamtsumme", "bruttobetrag", "brutto", "summe",
    "gesamt", "total", "betrag eur", "betrag",
)
_DATUM_WOERTER = ("rechnungsdatum", "belegdatum", "datum", "date")

# Typische Installationsorte von Tesseract unter Windows.
_TESSERACT_WINDOWS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)


def text_aus_datei(pfad: Path) -> str:
    """Liest den Volltext einer Belegdatei (PDF oder Bild)."""
    suffix = pfad.suffix.lower()
    if suffix == ".pdf":
        text = _pdf_text(pfad)
        if len(text.strip()) < 20:
            # Eingescanntes PDF ohne Textebene → Seiten per OCR lesen.
            text = _pdf_ocr(pfad) or text
        return text
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


def _tesseract_einrichten():
    """Lädt pytesseract und findet die Tesseract-Programmdatei.

    Liefert das Modul oder ``None``, wenn OCR nicht verfügbar ist.
    """
    try:
        import pytesseract  # type: ignore
    except ImportError:
        return None
    import shutil

    if shutil.which(pytesseract.pytesseract.tesseract_cmd) is None:
        for kandidat in _TESSERACT_WINDOWS:
            if Path(kandidat).is_file():
                pytesseract.pytesseract.tesseract_cmd = kandidat
                break
    try:
        pytesseract.get_tesseract_version()
    except Exception:  # noqa: BLE001
        return None
    return pytesseract


def ocr_status() -> tuple[bool, str]:
    """Prüft, ob Texterkennung für Fotos/Scans verfügbar ist."""
    try:
        import PIL  # noqa: F401
    except ImportError:
        return False, ("Paket „Pillow“ fehlt: pip install Pillow pytesseract")
    modul = _tesseract_einrichten()
    if modul is None:
        return False, (
            "Tesseract-OCR ist nicht installiert. Windows: Installer von "
            "github.com/UB-Mannheim/tesseract/wiki herunterladen, bei der "
            "Installation „German“ als Sprache anhaken; außerdem "
            "pip install pytesseract Pillow."
        )
    try:
        sprachen = modul.get_languages(config="")
    except Exception:  # noqa: BLE001
        sprachen = []
    if "deu" not in sprachen:
        return True, ("Tesseract gefunden, aber ohne deutsche Sprachdaten "
                      "(deu) – Umlaute und Beträge werden schlechter erkannt.")
    return True, "Texterkennung (Tesseract, Deutsch) ist verfügbar."


def _bild_oeffnen(pfad: Path):
    from PIL import Image  # type: ignore

    if pfad.suffix.lower() in (".heic", ".heif"):
        try:
            from pillow_heif import register_heif_opener  # type: ignore
            register_heif_opener()
        except ImportError:
            return None
    return Image.open(str(pfad))


def _bild_vorbereiten(bild):
    """Bereitet ein Handyfoto für die OCR vor.

    EXIF-Drehung anwenden, in Graustufen wandeln, Kontrast strecken und
    kleine Bilder hochskalieren — das verbessert die Erkennung von
    Beträgen auf Fotos deutlich.
    """
    from PIL import ImageFilter, ImageOps  # type: ignore

    bild = ImageOps.exif_transpose(bild)
    bild = bild.convert("L")
    bild = ImageOps.autocontrast(bild, cutoff=1)
    breite, hoehe = bild.size
    if max(breite, hoehe) < 1800:
        faktor = 1800 / max(breite, hoehe)
        bild = bild.resize((int(breite * faktor), int(hoehe * faktor)))
    return bild.filter(ImageFilter.SHARPEN)


def _ocr_bild(bild, modul) -> str:
    """OCR eines vorbereiteten Bildes, inkl. Korrektur gedrehter Fotos."""
    sprache = "deu"
    try:
        if "deu" not in modul.get_languages(config=""):
            sprache = "eng"
    except Exception:  # noqa: BLE001
        pass
    try:
        osd = modul.image_to_osd(bild, output_type=modul.Output.DICT)
        drehung = int(osd.get("rotate", 0))
        if drehung:
            bild = bild.rotate(-drehung, expand=True)
    except Exception:  # noqa: BLE001 - OSD optional (zu wenig Text o. ä.)
        pass
    try:
        return modul.image_to_string(bild, lang=sprache, config="--psm 4")
    except Exception:  # noqa: BLE001
        return ""


def _ocr_text(pfad: Path) -> str:
    """Liest Text aus einer Bilddatei per OCR (falls Tesseract installiert)."""
    modul = _tesseract_einrichten()
    if modul is None:
        return ""
    try:
        bild = _bild_oeffnen(pfad)
        if bild is None:
            return ""
        return _ocr_bild(_bild_vorbereiten(bild), modul)
    except Exception:  # noqa: BLE001
        return ""


def _pdf_ocr(pfad: Path) -> str:
    """OCR für eingescannte PDFs (Seiten als Bild, 300 dpi)."""
    modul = _tesseract_einrichten()
    if modul is None:
        return ""
    try:
        import pdfplumber
        teile = []
        with pdfplumber.open(str(pfad)) as pdf:
            for seite in pdf.pages[:5]:
                bild = seite.to_image(resolution=300).original
                teile.append(_ocr_bild(_bild_vorbereiten(bild), modul))
        return "\n".join(teile)
    except Exception:  # noqa: BLE001
        return ""


def _geld(treffer: re.Match) -> Decimal | None:
    ganz = re.sub(r"[.\u00a0 ]", "", treffer.group(1))
    try:
        return Decimal(f"{ganz}.{treffer.group(2)}")
    except InvalidOperation:
        return None


def gesamtbetrag_aus_text(text: str) -> Decimal | None:
    """Sucht den zu zahlenden Gesamtbetrag eines Belegs.

    Bevorzugt Beträge in Zeilen mit „Summe“, „Gesamt“, „zu zahlen“ usw.
    (auch in der Folgezeile). Ohne solches Stichwort wird der größte
    Betrag genommen. Liefert ``None``, wenn kein Betrag erkannt wurde.
    """
    zeilen = [z.strip() for z in (text or "").splitlines()]
    for wort in _GESAMT_WOERTER:
        for index in range(len(zeilen) - 1, -1, -1):
            zeile = zeilen[index].lower()
            if wort not in zeile or "zwischensumme" in zeile:
                continue
            for kandidat in (zeilen[index], zeilen[index + 1]
                             if index + 1 < len(zeilen) else ""):
                betraege = [b for b in (_geld(t) for t in
                                        _GELD_RE.finditer(kandidat)) if b]
                if betraege:
                    return betraege[-1]
    alle = _betraege_aus_text(text)
    return max(alle) if alle else None


def beleg_analysieren(pfad: Path) -> dict:
    """Liest einen Beleg und erkennt Gesamtbetrag und Rechnungsdatum."""
    text = text_aus_datei(Path(pfad))
    return {
        "text": text,
        "betrag": gesamtbetrag_aus_text(text),
        "datum": _datum_aus_text(text),
        "lesbar": bool(text.strip()),
    }


def beleg_text_aktualisieren(
    verbindung: sqlite3.Connection, relativer_pfad: str
) -> str:
    """Liest die Belegdatei und speichert den Volltext in der DB.

    ``relativer_pfad`` ist wie in der Buchung gespeichert relativ zum
    App-Ordner (z. B. ``belege/2026/rechnung.jpg``).
    """
    from src.logic.belege import beleg_absolut

    absoluter_pfad = beleg_absolut(relativer_pfad)
    if not absoluter_pfad.is_file():
        # Ältere Einträge relativ zum Belege-Ordner.
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


def _datum_gueltig(jahr: int, monat: int, tag: int) -> str | None:
    if jahr < 100:
        jahr += 2000
    try:
        wert = date(jahr, monat, tag)
    except ValueError:
        return None
    if not 2000 <= wert.year <= date.today().year + 1:
        return None
    return wert.isoformat()


def _datum_aus_text(text: str) -> str | None:
    """Sucht das Belegdatum: bevorzugt hinter „Rechnungsdatum“/„Datum“,
    sonst das erste plausible Datum im Text."""
    zeilen = (text or "").splitlines()
    for wort in _DATUM_WOERTER:
        for index, zeile in enumerate(zeilen):
            if wort not in zeile.lower():
                continue
            for kandidat in (zeile, zeilen[index + 1]
                             if index + 1 < len(zeilen) else ""):
                for t in _DATUM_DE_RE.finditer(kandidat):
                    iso = _datum_gueltig(int(t.group(3)), int(t.group(2)),
                                         int(t.group(1)))
                    if iso:
                        return iso
    for t in _DATUM_DE_RE.finditer(text or ""):
        iso = _datum_gueltig(int(t.group(3)), int(t.group(2)), int(t.group(1)))
        if iso:
            return iso
    for t in _DATUM_ISO_RE.finditer(text or ""):
        iso = _datum_gueltig(int(t.group(1)), int(t.group(2)), int(t.group(3)))
        if iso:
            return iso
    return None


def _betraege_aus_text(text: str) -> list[Decimal]:
    """Extrahiert alle plausiblen Geldbeträge aus dem Belegtext."""
    return [b for b in (_geld(t) for t in _GELD_RE.finditer(text or ""))
            if b is not None]


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
    for datei in sorted(belege_ordner.iterdir()):
        if not datei.is_file() or datei.suffix.lower() not in BELEG_ENDUNGEN:
            continue
        analyse = beleg_analysieren(datei)
        text = analyse["text"]
        gesamt = analyse["betrag"]
        betraege = _betraege_aus_text(text)
        beleg_datum = analyse["datum"]
        bester: dict | None = None
        for buchung in offene:
            try:
                buchungs_betrag = abs(Decimal(buchung["betrag"]))
            except (ValueError, TypeError, ArithmeticError):
                continue
            if gesamt is not None and abs(gesamt - buchungs_betrag) \
                    <= Decimal("0.01"):
                score = 60          # Gesamtbetrag des Belegs passt
            elif any(abs(b - buchungs_betrag) <= Decimal("0.01")
                     for b in betraege):
                score = 40          # irgendein Betrag im Beleg passt
            else:
                continue
            if beleg_datum and buchung["datum"]:
                try:
                    delta = abs(
                        date.fromisoformat(buchung["datum"]).toordinal()
                        - date.fromisoformat(beleg_datum).toordinal()
                    )
                    # Rechnungen werden oft erst nach Wochen bezahlt.
                    if delta <= 45:
                        score += 45 - delta
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
