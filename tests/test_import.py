"""Tests für PDF-Parser, Klassifizierung und Import-Buchung."""

from __future__ import annotations

from decimal import Decimal

from src.db import mietzahlungen
from src.logic import lernsystem, steuer
from src.logic.import_buchen import kandidat_buchen, leistungsmonat
from src.logic.pdf_import import (
    auszug_kennung, buchungszeilen_aus_text, saldo_pruefen,
)
from src.utils.eingaben import betrag_mit_vorzeichen_parsen, datum_iso_parsen
from tests.conftest import haus_id, kategorie_id, mieter_anlegen

D = Decimal

JANUAR_AUSZUG = """Emsländische Volksbank eG
Kontoauszug Nr. 1/2026
Kontonummer 324779100
Bu-Tag Wert Vorgang
alter Kontostand vom 30.12.2025 62.595,79 H
31.12. 31.12. Abschluss 12,50 S
Abschluss vom 01.10. bis 31.12.
02.01. 02.01. Dauerauftragsgutschr 650,00 H
Anna Beispiel Miete Januar
05.01. 05.01. Basislastschrift 81,28 S
Gemeinde Twist GRUNDSTEUER 1VJ 2026
Sudstrase 268, 49767 Twist 81,28 04.02.26 NR. 44012756
Übertrag auf Blatt 2 63.151,01 H
Übertrag von Blatt 1 63.151,01 H
Bu-Tag Wert Vorgang
07.01. 07.01. Überweisungsgutschr. 45,10 H
Stadtwerke Guthaben Abrechnung 2025
neuer Kontostand vom 31.01.2026 63.197,11 H
Sehr geehrte Kundin, sehr geehrter Kunde,
02.01. 02.01. Fake 999,00 H
"""


def test_parser_jahreswechsel_und_saldo():
    zeilen = buchungszeilen_aus_text(JANUAR_AUSZUG)
    assert [z["datum"] for z in zeilen] == [
        "2025-12-31", "2026-01-02", "2026-01-05", "2026-01-07"]
    assert [z["betrag"] for z in zeilen] == [
        D("-12.50"), D("650.00"), D("-81.28"), D("45.10")]
    assert saldo_pruefen(JANUAR_AUSZUG, zeilen)["stimmt"]
    assert auszug_kennung(JANUAR_AUSZUG) == "324779100|1/2026"


def test_parser_ohne_saldodatum_dezember_ins_vorjahr():
    text = ("Kontoauszug Nr. 1/2026\n30.12. 30.12. Lastschrift 10,00 S\n"
            "03.01. 03.01. Gutschrift 5,00 H\n")
    assert [z["datum"] for z in buchungszeilen_aus_text(text)] == [
        "2025-12-30", "2026-01-03"]


def test_grundsteuer_nicht_als_einkommensteuer(db):
    k = lernsystem.klassifizieren(
        db, "2026-01-05", D("-81.28"),
        "Basislastschrift Gemeinde Twist GRUNDSTEUER 1VJ 2026",
    )
    assert k["kategorie_id"] == kategorie_id(db, "Grundsteuer/Gemeindeabgaben")
    k2 = lernsystem.klassifizieren(
        db, "2026-03-10", D("-5850.00"),
        "Basislastschrift FINANZAMT LINGEN EINK.ST 1VJ.26",
    )
    assert k2["kategorie_id"] == kategorie_id(
        db, "Einkommensteuer/Finanzamt (privat)")


def test_kurze_stichworte_nur_als_wort(db):
    k = lernsystem.klassifizieren(db, "2026-01-05", D("-40.00"),
                                  "Lastschrift Gasthaus Zur Linde")
    assert k["kategorie_id"] != kategorie_id(db, "Heizung/Gas")


def test_erstattung_wird_gegenbuchung(db):
    haus = haus_id(db, "Südstraße")
    k = lernsystem.klassifizieren(
        db, "2026-01-07", D("45.10"),
        "Überweisungsgutschr. Stadtwerke Guthaben", standard_haus=haus,
    )
    assert k["kategorie_id"] == kategorie_id(db, "Heizung/Gas")
    ids, _ = kandidat_buchen(db, k, haus, k["kategorie_id"], None)
    betrag = db.execute("SELECT betrag FROM buchungen WHERE id = ?",
                        (ids[0],)).fetchone()["betrag"]
    assert D(betrag) == D("-45.10")
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_SUMME"]["angesetzt"] == D("-45.10")


def test_miete_wird_in_kalt_und_nk_aufgeteilt(db):
    haus = haus_id(db, "Südstraße")
    mieter = mieter_anlegen(db, haus, "Anna Beispiel", kalt="500", nk="150")
    k = lernsystem.klassifizieren(
        db, "2026-01-02", D("650.00"),
        "Dauerauftragsgutschr Anna Beispiel Miete", standard_haus=haus,
    )
    assert k["mieter_id"] == mieter
    ids, hinweis = kandidat_buchen(db, k, haus, k["kategorie_id"], mieter)
    assert hinweis is None and len(ids) == 2
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["E_MIETE"]["angesetzt"] == D("500.00")
    assert a["positionen"]["E_UMLAGEN"]["angesetzt"] == D("150.00")
    assert mietzahlungen.bezahlte_monate(db, mieter, 2026) == {1}
    # Dublette wird über die Summe der Teile erkannt.
    k2 = lernsystem.klassifizieren(
        db, "2026-01-02", D("650.00"), "Dauerauftragsgutschr Anna Beispiel",
    )
    assert k2["dublette"]


def test_abweichende_miete_bleibt_ungeteilt_mit_hinweis(db):
    haus = haus_id(db, "Südstraße")
    mieter = mieter_anlegen(db, haus, "Bert Muster", kalt="500", nk="150")
    k = lernsystem.klassifizieren(db, "2026-02-27", D("600.00"),
                                  "Gutschrift Bert Muster", standard_haus=haus)
    ids, hinweis = kandidat_buchen(db, k, haus, k["kategorie_id"], mieter)
    assert len(ids) == 1 and "weicht" in hinweis
    # Zahlung am 27.02. gilt als März-Miete.
    assert mietzahlungen.bezahlte_monate(db, mieter, 2026) == {3}


def test_leistungsmonat_jahreswechsel():
    assert leistungsmonat("2026-12-28") == (2027, 1)
    assert leistungsmonat("2026-12-03") == (2026, 12)


def test_hilfsparser():
    assert betrag_mit_vorzeichen_parsen("-1.234,50") == D("-1234.50")
    assert betrag_mit_vorzeichen_parsen("23,00 S") == D("-23.00")
    assert betrag_mit_vorzeichen_parsen("23,00 H") == D("23.00")
    assert betrag_mit_vorzeichen_parsen("23,00-") == D("-23.00")
    assert datum_iso_parsen("31.12.2025") == "2025-12-31"
    assert datum_iso_parsen("2026-01-02") == "2026-01-02"
    assert datum_iso_parsen("32.01.2026") is None
