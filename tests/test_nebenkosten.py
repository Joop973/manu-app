"""Nebenkostenabrechnung: cent-genau, Leerstand, Ist-Vorauszahlungen."""

from __future__ import annotations

from decimal import Decimal

from src.db import buchungen, stammdaten
from src.logic import nebenkosten
from src.logic.import_buchen import kandidat_buchen
from tests.conftest import haus_id, kategorie_id, mieter_anlegen

D = Decimal


def test_verteilung_ist_cent_genau():
    teile = nebenkosten.cent_genau_verteilen(D("100.00"), [D(1)] * 3, D(3))
    assert teile[:3] == [D("33.34"), D("33.33"), D("33.33")]
    assert sum(teile) == D("100.00") and teile[3] == 0
    teile = nebenkosten.cent_genau_verteilen(D("-10.00"), [D(1)] * 3, D(4))
    assert sum(teile) == D("-10.00")


def _haus_mit_kosten(db):
    haus = haus_id(db, "Annaveenstraße")
    wasser = kategorie_id(db, "Wasser/Abwasser")
    muell = kategorie_id(db, "Müllabfuhr")
    for k in (wasser, muell):
        stammdaten.kategorie_umlagefaehig_setzen(db, k, True)
    buchungen.buchung_anlegen(db, "2026-03-01", D("1000.01"), haus, wasser,
                              "Wasser", None, "manuell")
    buchungen.buchung_anlegen(db, "2026-04-01", D("333.33"), haus, muell,
                              "Müll", None, "manuell")
    buchungen.buchung_anlegen(db, "2026-09-01", D("-0.34"), haus, wasser,
                              "Erstattung", None, "manuell")
    return haus


def test_summe_der_anteile_gleich_kosten(db):
    haus = _haus_mit_kosten(db)
    for name, flaeche in (("A", "47.3"), ("B", "61.9"), ("C", "38.15")):
        mieter_anlegen(db, haus, name, flaeche=flaeche)
    a = nebenkosten.abrechnung_erstellen(db, haus, 2026)
    assert a["kosten_gesamt"] == D("1333.00")
    assert sum(m["kostenanteil"] for m in a["mieter"]) == a["kosten_gesamt"]
    assert a["anteil_vermieter"] == 0
    assert a["hinweise"]  # keine Gesamtfläche hinterlegt


def test_leerstand_traegt_vermieter(db):
    haus = _haus_mit_kosten(db)
    stammdaten.objekt_steuerdaten_setzen(db, haus, None, D("100"), None, None,
                                         None, None)
    mieter_anlegen(db, haus, "A", flaeche="50")
    mieter_anlegen(db, haus, "B", flaeche="50", bis="2026-06-30")
    a = nebenkosten.abrechnung_erstellen(db, haus, 2026)
    summe_mieter = sum(m["kostenanteil"] for m in a["mieter"])
    assert summe_mieter + a["anteil_vermieter"] == a["kosten_gesamt"]
    assert a["anteil_vermieter"] > D("300")   # ~ 1/4 der Kosten
    assert a["mieter"][0]["kostenanteil"] == D("666.50")


def test_vorauszahlung_aus_gebuchten_zahlungen(db):
    haus = haus_id(db, "Finkenstraße")
    m = mieter_anlegen(db, haus, "Clara Test", kalt="400", nk="100")
    kalt = kategorie_id(db, "Kaltmiete")
    for monat in range(1, 13):
        kandidat_buchen(db, {"datum": f"2026-{monat:02d}-02",
                             "betrag": D("500.00"), "text": "Miete"},
                        haus, kalt, m)
    # Dezember-Zahlung für Januar 2027 zählt nicht für 2026.
    kandidat_buchen(db, {"datum": "2026-12-28", "betrag": D("500.00"),
                         "text": "Miete Januar"}, haus, kalt, m)
    a = nebenkosten.abrechnung_erstellen(db, haus, 2026)
    eintrag = a["mieter"][0]
    assert eintrag["vorauszahlung"] == D("1200.00")
    assert eintrag["vorauszahlung_quelle"] == "gebucht"


def test_mieteinnahmen_nachweis_ist(db):
    haus = haus_id(db, "Finkenstraße")
    m = mieter_anlegen(db, haus, "Clara Test", kalt="400", nk="100")
    kandidat_buchen(db, {"datum": "2026-02-02", "betrag": D("500.00"),
                         "text": "Miete"}, haus, kategorie_id(db, "Kaltmiete"),
                    m)
    daten = nebenkosten.mieteinnahmen_daten(db, haus, 2026)
    assert daten["gesamt"] == D("500.00")
    assert daten["mieter"][0]["kaltmiete"] == D("400.00")
    assert daten["mieter"][0]["monate"] == {2: D("500.00")}
