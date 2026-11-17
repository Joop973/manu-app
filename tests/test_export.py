"""Exporte: DATEV-Buchungsstapel, Anlage-V-Excel, Steuerpaket."""

from __future__ import annotations

import os
import zipfile
from decimal import Decimal

import pytest
from openpyxl import load_workbook

from src.db import buchungen, stammdaten
from src.logic import datev, steuer_export
from src.utils.eingaben import ValidierungsFehler
from tests.conftest import haus_id, kategorie_id

D = Decimal


def _daten(db, app_ordner):
    sued = haus_id(db, "Südstraße")
    beleg = app_ordner / "belege" / "2026" / "rechnung.pdf"
    beleg.parent.mkdir(parents=True, exist_ok=True)
    beleg.write_bytes(b"%PDF-1.4 test")
    buchungen.buchung_anlegen(db, "2026-01-02", D("500.00"), sued,
                              kategorie_id(db, "Kaltmiete"), "Miete Januar",
                              None, "import")
    internet = kategorie_id(db, "Internet/Telefon für Mieter")
    stammdaten.kategorie_steuer_setzen(db, internet, "wk_laufend", D("60"),
                                       None)
    buchungen.buchung_anlegen(db, "2026-02-10", D("39.99"), sued, internet,
                              "Vodafone; Kabel \"Internet\"",
                              "belege/2026/rechnung.pdf", "import")
    buchungen.buchung_anlegen(db, "2025-12-29", D("12.00"), sued,
                              kategorie_id(db, "Kontoführung/Bankgebühren"),
                              "Abschluss", None, "import", steuerjahr=2026)
    buchungen.buchung_anlegen(db, "2026-03-10", D("5850.00"), sued,
                              kategorie_id(db,
                                           "Einkommensteuer/Finanzamt (privat)"),
                              "Finanzamt", None, "import")
    return sued


def test_datev_braucht_beraternummer(db, app_ordner):
    _daten(db, app_ordner)
    with pytest.raises(ValidierungsFehler):
        datev.buchungsstapel_schreiben(db, 2026, app_ordner / "x.csv")


def test_datev_format(db, app_ordner):
    _daten(db, app_ordner)
    datev.einstellungen_speichern(db, {"berater": "29098", "mandant": "55003",
                                       "skr": "03"})
    pfad, _ = datev.buchungsstapel_schreiben(db, 2026, app_ordner / "x.csv")
    roh = pfad.read_bytes()
    assert roh.endswith(b"\r\n") and b"\r\n" in roh
    zeilen = roh.decode("cp1252").split("\r\n")[:-1]
    kopf = zeilen[0].split(";")
    assert len(kopf) == 31
    assert kopf[:5] == ['"EXTF"', "700", "21", '"Buchungsstapel"', "13"]
    assert kopf[10:16] == ["29098", "55003", "20260101", "4", "20260101",
                           "20261231"]
    assert len(zeilen[1].split(";")) == 125
    daten = [z.split(";") for z in zeilen[2:]]
    assert all(len(z) == 125 for z in daten)
    # Miete: Bank im Soll
    miete = next(z for z in daten if z[13].startswith('"Kaltmiete'))
    assert miete[0] == "500,00" and miete[1] == '"S"'
    assert miete[6] == "1200" and miete[7] == "2750"
    assert miete[36] == '"SUEDSTRASSE"'
    # Internet 60 %: Aufteilung 23,99 Sachkonto + 16,00 privat, Summe exakt
    internet = [z for z in daten if "Internet" in z[13]]
    assert sorted(z[0] for z in internet) == ["16,00", "23,99"]
    assert {z[7] for z in internet} == {"2350", "1800"}
    assert all(z[1] == '"H"' for z in internet)
    # §11: Zahlung 2025 im Stapel 2026 → Belegdatum 0101 mit Vermerk
    gebuehr = next(z for z in daten if "Kontoführung" in z[13])
    assert gebuehr[9] == "0101" and "§11" in gebuehr[13]
    # Einkommensteuer auf Privatkonto
    est = next(z for z in daten if "Einkommensteuer" in z[13])
    assert est[7] == "1800"
    for z in daten:
        assert len(z[13].strip('"')) <= 60
        assert z[10].strip('"').isalnum()


def test_anlage_v_excel_und_paket(db, app_ordner, monkeypatch):
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    # Immer eine QApplication (Widgets), damit spätere UI-Tests im selben
    # Prozess laufen können.
    from PySide6.QtWidgets import QApplication
    app = QApplication.instance() or QApplication([])  # noqa: F841

    _daten(db, app_ordner)
    datev.einstellungen_speichern(db, {"berater": "29098", "mandant": "1",
                                       "skr": "03"})
    ergebnis = steuer_export.steuerpaket_erstellen(db, 2026)
    assert ergebnis["belege"] == 1
    namen = {p.name for p in ergebnis["ordner"].rglob("*") if p.is_file()}
    assert "AnlageV_2026.xlsx" in namen
    assert "Steuerbericht_Suedstrasse_2026.pdf" in namen
    assert "EXTF_Buchungsstapel_2026.csv" in namen
    assert any(n.startswith("B0000") and n.endswith(".pdf") for n in namen)
    with zipfile.ZipFile(ergebnis["zip"]) as z:
        assert any(n.endswith("AnlageV_2026.xlsx") for n in z.namelist())

    wb = load_workbook(ergebnis["ordner"] / "AnlageV_2026.xlsx")
    assert {"Übersicht", "Einzelnachweis", "Prüfhinweise"} <= set(
        wb.sheetnames)
    blatt = wb["Suedstrasse"]
    werte = {blatt.cell(z, 2).value: blatt.cell(z, 5).value
             for z in range(6, 20)}
    assert werte["Mieteinnahmen für Wohnungen (ohne Umlagen)"] == 500.0
    assert werte["Summe der Werbungskosten"] == pytest.approx(23.99 + 12.0)
    einzel = wb["Einzelnachweis"]
    links = [einzel.cell(z, 17).hyperlink for z in range(2, 6)]
    assert any(link is not None and "Belege/" in link.target
               for link in links)
