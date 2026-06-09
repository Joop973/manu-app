"""Diagnose-Skript: Schreibt den Rohtext eines Kontoauszug-PDFs in
eine .txt-Datei, damit er als Vorlage für den Parser dienen kann.

Aufruf in der Eingabeaufforderung:

    python rohtext_dump.py PFAD\\ZU\\AUSZUG.pdf

Ergebnis ist eine Datei mit demselben Namen, aber Endung .txt, im
selben Ordner wie das PDF. Bitte vor dem Versenden sensible Daten
(Kontonummern, Namen) schwärzen.
"""

from __future__ import annotations

import sys
from pathlib import Path

from src.logic.pdf_import import rohtext_lesen


def main() -> int:
    if len(sys.argv) != 2:
        print("Bitte einen PDF-Pfad angeben:")
        print("  python rohtext_dump.py auszug.pdf")
        return 1
    pdf_pfad = Path(sys.argv[1])
    if not pdf_pfad.is_file():
        print(f"Datei nicht gefunden: {pdf_pfad}")
        return 1
    text = rohtext_lesen(pdf_pfad)
    ziel = pdf_pfad.with_suffix(".txt")
    ziel.write_text(text, encoding="utf-8")
    print(f"Rohtext gespeichert: {ziel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
