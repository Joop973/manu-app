"""Beleg-Erkennung: Gesamtbetrag, Datum und OCR von Fotos."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from src.logic import beleg_text

D = Decimal

RECHNUNG = """Malerbetrieb Schulz
Rechnungsdatum: 14.03.2026
Leistung vom 02.03.2026
Position 1   Wand streichen   850,00
Position 2   Material         150,42
Zwischensumme               1.000,42
MwSt 19 %                     190,08
Gesamtbetrag              1.190,50 EUR
Zahlbar bis 28.03.2026
"""


def test_gesamtbetrag_und_datum():
    assert beleg_text.gesamtbetrag_aus_text(RECHNUNG) == D("1190.50")
    assert beleg_text._datum_aus_text(RECHNUNG) == "2026-03-14"


def test_betrag_ohne_stichwort_nimmt_groessten():
    assert beleg_text.gesamtbetrag_aus_text("12,00\n7,50\n19,99") == D("19.99")


def _schrift(groesse):
    from PIL import ImageFont
    for kandidat in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                     "C:/Windows/Fonts/arial.ttf"):
        if Path(kandidat).is_file():
            return ImageFont.truetype(kandidat, groesse)
    pytest.skip("keine Schrift für den OCR-Test")


@pytest.mark.skipif(beleg_text._tesseract_einrichten() is None,
                    reason="Tesseract nicht installiert")
def test_ocr_gedrehtes_handyfoto(tmp_path):
    from PIL import Image, ImageDraw

    bild = Image.new("RGB", (1000, 700), (235, 232, 225))
    zeichnen = ImageDraw.Draw(bild)
    schrift = _schrift(36)
    for i, zeile in enumerate([
        "Baumarkt Twist GmbH", "Datum: 05.02.2026",
        "Silikon weiss      12,99", "Dichtband          34,50",
        "SUMME EUR          47,49", "Vielen Dank",
    ]):
        zeichnen.text((60, 50 + i * 95), zeile, fill=(30, 30, 30),
                      font=schrift)
    # Wie ein hochkant gehaltenes Handy: Pixel gedreht, EXIF sagt „drehen“.
    gedreht = bild.rotate(90, expand=True)
    exif = Image.Exif()
    exif[0x0112] = 8     # Orientation: 90° gegen den Uhrzeigersinn
    datei = tmp_path / "quittung.jpg"
    gedreht.save(datei, exif=exif.tobytes(), quality=85)

    analyse = beleg_text.beleg_analysieren(datei)
    assert analyse["betrag"] == D("47.49"), analyse["text"]
    assert analyse["datum"] == "2026-02-05"
