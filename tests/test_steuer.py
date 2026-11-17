"""Tests der steuerlichen Auswertung (Anlage V)."""

from __future__ import annotations

from decimal import Decimal

from src.db import buchungen, investitionen, stammdaten
from src.logic import steuer
from tests.conftest import haus_id, kategorie_id, mieter_anlegen

D = Decimal


def _buchen(db, datum, betrag, haus, kategorie, text="", quelle="manuell",
            **kw):
    return buchungen.buchung_anlegen(
        db, datum, D(betrag), haus, kategorie, text, None, quelle, **kw
    )


def test_einkommensteuer_ist_keine_werbungskosten(db):
    haus = haus_id(db, "Südstraße")
    _buchen(db, "2026-03-10", "23400.00", haus,
            kategorie_id(db, "Einkommensteuer/Finanzamt (privat)"))
    _buchen(db, "2026-02-15", "300.00", haus,
            kategorie_id(db, "Grundsteuer/Gemeindeabgaben"))
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_SUMME"]["angesetzt"] == D("300.00")
    assert len(a["nicht_beruecksichtigt"]) == 1


def test_ruecklage_und_kaution_sind_neutral(db):
    haus = haus_id(db, "Südstraße")
    _buchen(db, "2026-01-05", "1000.00", haus,
            kategorie_id(db, "Rücklage (Umbuchung eigenes Geld)"))
    _buchen(db, "2026-01-06", "1500.00", haus, kategorie_id(db, "Mietkaution"))
    _buchen(db, "2026-01-03", "500.00", haus, kategorie_id(db, "Kaltmiete"))
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["E_SUMME"]["angesetzt"] == D("500.00")


def test_erstattung_mindert_kosten(db):
    haus = haus_id(db, "Südstraße")
    gas = kategorie_id(db, "Heizung/Gas")
    _buchen(db, "2026-02-01", "1200.00", haus, gas)
    _buchen(db, "2026-05-01", "-150.25", haus, gas)   # Guthaben Versorger
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_NICHT_UMGELEGT"]["angesetzt"] == D("1049.75")


def test_umlagefaehige_kosten_landen_in_umgelegt(db):
    haus = haus_id(db, "Südstraße")
    wasser = kategorie_id(db, "Wasser/Abwasser")
    stammdaten.kategorie_umlagefaehig_setzen(db, wasser, True)
    _buchen(db, "2026-02-01", "400.00", haus, wasser)
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_UMGELEGT"]["angesetzt"] == D("400.00")
    assert a["positionen"]["WK_NICHT_UMGELEGT"]["angesetzt"] == D("0")


def test_prozent_rangfolge_buchung_haus_kategorie(db):
    sued = haus_id(db, "Südstraße")
    finken = haus_id(db, "Finkenstraße")
    kat = kategorie_id(db, "Internet/Telefon für Mieter")
    stammdaten.kategorie_steuer_setzen(db, kat, "wk_laufend", D("50"), None)
    stammdaten.haus_anteil_setzen(db, kat, finken, D("80"))
    _buchen(db, "2026-01-10", "100.00", sued, kat)             # 50 %
    _buchen(db, "2026-01-10", "100.00", finken, kat)           # 80 %
    _buchen(db, "2026-02-10", "100.00", finken, kat,
            steuer_prozent=D("33.33"))                         # 33,33 %
    a_sued = steuer.auswertung(db, sued, 2026)
    a_finken = steuer.auswertung(db, finken, 2026)
    assert a_sued["positionen"]["WK_SUMME"]["angesetzt"] == D("50.00")
    assert a_finken["positionen"]["WK_SUMME"]["angesetzt"] == D("113.33")
    assert a_finken["positionen"]["WK_SUMME"]["gesamt"] == D("200.00")
    quellen = sorted(p["prozent_quelle"] for p in a_finken["posten"])
    assert quellen == ["Buchung", "Haus"]


def test_steuerjahr_verschiebt_buchung(db):
    haus = haus_id(db, "Südstraße")
    miete = kategorie_id(db, "Kaltmiete")
    _buchen(db, "2025-12-29", "500.00", haus, miete, steuerjahr=2026)
    _buchen(db, "2026-12-30", "500.00", haus, miete)
    assert steuer.auswertung(db, haus, 2026)["einkuenfte"] == D("1000.00")
    assert steuer.auswertung(db, haus, 2025)["einkuenfte"] == D("0")


def test_ungeklaerte_ausgabe_wird_nicht_angesetzt_und_gemeldet(db):
    haus = haus_id(db, "Südstraße")
    _buchen(db, "2026-04-01", "99.99", haus, kategorie_id(db, "Sonstiges",
                                                          "ausgabe"))
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_SUMME"]["angesetzt"] == D("0")
    hinweise = steuer.pruefen(db, 2026)
    assert any(h["stufe"] == steuer.FEHLER and "Sonstiges" in h["text"]
               for h in hinweise)


def test_pruefbericht_erkennt_erstattung_und_10_tage(db):
    haus = haus_id(db, "Südstraße")
    gas = kategorie_id(db, "Heizung/Gas")
    miete = kategorie_id(db, "Kaltmiete")
    erstattung = _buchen(db, "2026-06-01", "80.00", haus, gas,
                         "Überweisungsgutschr. Stadtwerke Guthaben",
                         quelle="import")
    jan = _buchen(db, "2026-12-28", "500.00", haus, miete,
                  "Dauerauftragsgutschr Miete Januar", quelle="import")
    hinweise = steuer.pruefen(db, 2026)
    vorz = [h for h in hinweise if h["aktion"] == "vorzeichen"]
    assert vorz and vorz[0]["buchung_ids"] == [erstattung]
    zehn = [h for h in hinweise if h["aktion"] == "steuerjahr"]
    assert any(h["buchung_ids"] == [jan] and h["wert"] == 2027 for h in zehn)
    steuer.vorzeichen_umkehren(db, erstattung)
    steuer.steuerjahr_setzen(db, jan, 2027)
    a = steuer.auswertung(db, haus, 2026)
    assert a["positionen"]["WK_SUMME"]["angesetzt"] == D("-80.00")
    assert a["positionen"]["E_MIETE"]["angesetzt"] == D("0")


def test_gebaeude_afa_und_investitionen(db):
    haus = haus_id(db, "Südstraße")
    stammdaten.objekt_steuerdaten_setzen(
        db, haus, "Südstraße 1, 49767 Twist", D("300"), D("200000"),
        "2020-07-01", D("2"), "SUED",
    )
    investitionen.investition_anlegen(
        db, haus, "2026-03-01", D("12000"), "Dach", "erhaltung", 50,
        verteilung_jahre=3,
    )
    a = steuer.auswertung(db, haus, 2026)
    assert a["afa_gebaeude"]["betrag"] == D("4000.00")
    assert a["positionen"]["WK_AFA"]["angesetzt"] == D("4000.00")
    assert a["positionen"]["WK_ERHALTUNG"]["angesetzt"] == D("4000.00")


def test_doppelte_miete_checkliste_und_import(db):
    from src.db import mietzahlungen

    haus = haus_id(db, "Südstraße")
    mieter = mieter_anlegen(db, haus, "Anna Beispiel", kalt="500", nk="0")
    mietzahlungen.mietzahlung_erfassen(db, mieter, 3, 2026)
    _buchen(db, "2026-03-02", "500.00", haus, kategorie_id(db, "Kaltmiete"),
            quelle="import", mieter_id=mieter)
    assert any(h["bereich"] == "Doppelt" for h in steuer.pruefen(db, 2026))


def test_kategoriewechsel_behaelt_zahlungsrichtung(db):
    haus = haus_id(db, "Südstraße")
    sonst = kategorie_id(db, "Sonstiges", "ausgabe")
    miete = kategorie_id(db, "Kaltmiete")
    # Geldeingang 45 € zunächst als Einnahme gebucht …
    bid = _buchen(db, "2026-05-01", "45.00", haus, miete)
    gas = kategorie_id(db, "Heizung/Gas")
    # … dann als Gas-Erstattung umgeordnet: muss die Kosten mindern.
    buchungen.zuordnung_setzen(db, bid, haus, gas, None)
    assert D(db.execute("SELECT betrag FROM buchungen WHERE id = ?",
                        (bid,)).fetchone()["betrag"]) == D("-45.00")
    buchungen.buchung_felder_setzen(db, bid, kategorie_id=sonst)
    assert D(db.execute("SELECT betrag FROM buchungen WHERE id = ?",
                        (bid,)).fetchone()["betrag"]) == D("-45.00")
    buchungen.buchung_felder_setzen(db, bid, kategorie_id=miete)
    assert D(db.execute("SELECT betrag FROM buchungen WHERE id = ?",
                        (bid,)).fetchone()["betrag"]) == D("45.00")
