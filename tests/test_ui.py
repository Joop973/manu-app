"""Rauchtest der Oberfläche (ohne Bildschirm, Qt „offscreen“)."""

from __future__ import annotations

import os
from decimal import Decimal

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

QtWidgets = pytest.importorskip("PySide6.QtWidgets")

from src.db import buchungen  # noqa: E402
from tests.conftest import haus_id, kategorie_id  # noqa: E402

D = Decimal


@pytest.fixture
def qapp(monkeypatch):
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    box = QtWidgets.QMessageBox
    for name in ("information", "warning", "critical"):
        monkeypatch.setattr(box, name, staticmethod(lambda *a, **k: box.Ok))
    monkeypatch.setattr(box, "question", staticmethod(lambda *a, **k: box.No))
    monkeypatch.setattr(QtWidgets.QDialog, "exec", lambda self: 0)
    return app


def test_hauptfenster_und_seiten(qapp, db):
    from src.ui.main_window import NAVIGATIONSBEREICHE, MainWindow

    fenster = MainWindow(db)
    for index in range(len(NAVIGATIONSBEREICHE)):
        fenster._bereich_wechseln(index)
    fenster._update_hinweis_zeigen()
    fenster.close()


def test_buchungsdialog_erstattung_anteil_steuerjahr(qapp, db):
    from src.ui.buchungen_seite import BuchungDialog

    haus = haus_id(db, "Südstraße")
    gas = kategorie_id(db, "Heizung/Gas")
    bid = buchungen.buchung_anlegen(db, "2026-12-29", D("80.00"), haus, gas,
                                    "Gas", None, "manuell")
    dialog = BuchungDialog(db, bid)
    assert dialog._feld_richtung.currentData() == -1
    dialog._feld_richtung.setCurrentIndex(dialog._feld_richtung.findData(1))
    dialog._feld_anteil.setText("50")
    dialog._feld_steuerjahr.setCurrentIndex(
        dialog._feld_steuerjahr.findData(2027))
    dialog._speichern()
    zeile = db.execute("SELECT betrag, steuer_prozent, steuerjahr FROM "
                       "buchungen WHERE id = ?", (bid,)).fetchone()
    assert D(zeile["betrag"]) == D("-80.00")
    assert D(zeile["steuer_prozent"]) == D("50")
    assert zeile["steuerjahr"] == 2027

    neu = BuchungDialog(db)
    neu._feld_kategorie.setCurrentIndex(neu._feld_kategorie.findData(
        kategorie_id(db, "Kaltmiete")))
    assert neu._feld_richtung.currentData() == 1


def test_steuer_dialoge(qapp, db):
    from src.logic import steuer
    from src.ui.steuer_dialoge import (
        ExportEinstellungenDialog, HausSteuerDialog, KategorieSteuerDialog,
        PruefberichtDialog,
    )

    haus = haus_id(db, "Südstraße")
    sonst = kategorie_id(db, "Sonstiges", "ausgabe")
    d = KategorieSteuerDialog(db, sonst)
    d._art.setCurrentIndex(d._art.findData("wk_sonstige"))
    d._prozent.setText("80")
    d._tabelle.item(0, 1).setText("50")
    d._speichern()
    zeile = db.execute("SELECT steuer_art, steuer_prozent FROM kategorien "
                       "WHERE id = ?", (sonst,)).fetchone()
    assert zeile["steuer_art"] == "wk_sonstige"
    assert D(zeile["steuer_prozent"]) == D("80")

    h = HausSteuerDialog(db, haus)
    h._adresse.setText("Südstraße 268, 49767 Twist")
    h._flaeche.setText("180,5")
    h._afa_aktiv.setChecked(True)
    h._bemessung.setText("250.000,00")
    h._satz.setCurrentText("2")
    h._speichern()
    assert steuer.gebaeude_afa(db, haus, 2026)["betrag"] == D("5000.00")

    buchungen.buchung_anlegen(db, "2026-06-01", D("10.00"), haus,
                              kategorie_id(db, "Heizung/Gas"),
                              "Überweisungsgutschr. Erstattung", None, "import")
    p = PruefberichtDialog(db, 2026)
    zeilen = [i for i, h in enumerate(p._hinweise) if h["aktion"] == "vorzeichen"]
    assert zeilen
    p._tabelle.selectRow(zeilen[0])
    p._vorzeichen()
    assert not any(h["aktion"] == "vorzeichen" for h in p._hinweise)

    e = ExportEinstellungenDialog(db)
    e._berater.setText("29098")
    e._mandant.setText("12")
    e._speichern()
    from src.logic import datev
    assert datev.einstellungen_laden(db)["berater"] == "29098"


def test_stammdaten_und_export_seite(qapp, db):
    from src.ui.export_seite import ExportSeite
    from src.ui.stammdaten_seite import StammdatenSeite

    seite = StammdatenSeite(db)
    seite.aktualisieren()
    export = ExportSeite(db)
    export._status_aktualisieren()
    assert "Fehler" in export._status.text()
