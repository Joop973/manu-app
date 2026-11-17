"""Dialoge rund um die steuerliche Behandlung.

* ``KategorieSteuerDialog`` – steuerliche Art, Anteil (Voreinstellung),
  Ausnahmen je Haus und DATEV-Konto einer Kategorie
* ``HausSteuerDialog`` – Adresse, Gesamtwohnfläche, Kostenstelle und
  Gebäude-AfA eines Hauses
* ``PruefberichtDialog`` – Prüfbericht eines Steuerjahres mit
  Korrektur-Knöpfen (Vorzeichen, Steuerjahr)
* ``ExportEinstellungenDialog`` – DATEV-Daten und Zeilennummern der
  Anlage V
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from PySide6.QtCore import QDate, Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from src.db import stammdaten
from src.logic import datev, steuer
from src.utils.eingaben import (
    ValidierungsFehler, betrag_formatieren, betrag_parsen,
)

_STUFE_FARBE = {
    steuer.FEHLER: QColor("#f4cccc"),
    steuer.WARNUNG: QColor("#fff2cc"),
    steuer.INFO: QColor("#e8eef7"),
}


def _zahl_oder_none(text: str) -> Decimal | None:
    text = (text or "").strip()
    return betrag_parsen(text) if text else None


def steuer_art_combo(auswahl: str | None) -> QComboBox:
    """Auswahlfeld aller steuerlichen Arten (inkl. „noch nicht festgelegt“)."""
    combo = QComboBox()
    combo.addItem(steuer.UNGEKLAERT_TEXT, None)
    for schluessel in steuer.STEUER_ARTEN_REIHENFOLGE:
        art = steuer.STEUER_ARTEN[schluessel]
        combo.addItem(art.bezeichnung, schluessel)
        combo.setItemData(combo.count() - 1, art.hinweis, Qt.ToolTipRole)
    index = combo.findData(auswahl)
    combo.setCurrentIndex(max(index, 0))
    return combo


# =========================================================================
# Kategorie
# =========================================================================


class KategorieSteuerDialog(QDialog):
    """Steuerliche Einstellungen einer Kategorie."""

    def __init__(
        self, verbindung: sqlite3.Connection, kategorie_id: int, parent=None
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._kategorie_id = kategorie_id
        zeile = verbindung.execute(
            "SELECT name, typ, steuer_art, steuer_prozent, datev_konto, "
            "umlagefaehig FROM kategorien WHERE id = ?",
            (kategorie_id,),
        ).fetchone()
        self.setWindowTitle(f"Steuer-Einstellung: {zeile['name']}")
        self.setModal(True)
        self.resize(620, 520)

        layout = QVBoxLayout(self)
        formular = QFormLayout()
        self._art = steuer_art_combo(zeile["steuer_art"])
        self._art.currentIndexChanged.connect(self._erklaerung_zeigen)
        formular.addRow("Steuerliche Behandlung:", self._art)
        self._erklaerung = QLabel()
        self._erklaerung.setWordWrap(True)
        self._erklaerung.setStyleSheet("color: #555555;")
        formular.addRow("", self._erklaerung)

        self._prozent = QLineEdit(
            steuer.prozent_formatieren(steuer.dezimal(zeile["steuer_prozent"]))
            .replace(" %", "") or "100")
        self._prozent.setToolTip(
            "Welcher Anteil steuerlich angesetzt wird (0–100). Gilt für "
            "alle Häuser, sofern unten keine Ausnahme eingetragen ist; "
            "jede Buchung kann zusätzlich einen eigenen Wert haben.")
        formular.addRow("Anteil (Voreinstellung, %):", self._prozent)

        self._konto = QLineEdit(zeile["datev_konto"] or "")
        self._konto.setPlaceholderText("leer = Vorschlag je steuerlicher Art")
        formular.addRow("DATEV-Sachkonto:", self._konto)
        umlage = "ja" if zeile["umlagefaehig"] else "nein"
        formular.addRow("Umlagefähig:", QLabel(
            f"{umlage} – bestimmt bei laufenden Kosten, ob sie in der "
            "Anlage V als „umgelegt“ oder „nicht umgelegt“ erscheinen "
            "(Knopf „Umlagefähig ändern“)."))
        layout.addLayout(formular)

        gruppe = QGroupBox("Abweichender Anteil je Haus (leer = Voreinstellung)")
        gruppen_layout = QVBoxLayout(gruppe)
        self._haeuser = stammdaten.objekte_laden(verbindung)
        anteile = stammdaten.haus_anteile_laden(verbindung, kategorie_id)
        self._tabelle = QTableWidget(len(self._haeuser), 2)
        self._tabelle.setHorizontalHeaderLabels(["Haus", "Anteil %"])
        self._tabelle.verticalHeader().setVisible(False)
        self._tabelle.horizontalHeader().setSectionResizeMode(
            QHeaderView.Stretch)
        for index, haus in enumerate(self._haeuser):
            name = QTableWidgetItem(haus["name"])
            name.setFlags(name.flags() & ~Qt.ItemIsEditable)
            self._tabelle.setItem(index, 0, name)
            wert = anteile.get(haus["id"])
            self._tabelle.setItem(index, 1, QTableWidgetItem(
                "" if wert is None else
                steuer.prozent_formatieren(wert).replace(" %", "")))
        gruppen_layout.addWidget(self._tabelle)
        layout.addWidget(gruppe)

        knoepfe = QDialogButtonBox(QDialogButtonBox.Ok
                                   | QDialogButtonBox.Cancel)
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)
        self._erklaerung_zeigen()

    def _erklaerung_zeigen(self, *_args) -> None:
        art = self._art.currentData()
        if art is None:
            self._erklaerung.setText(
                "Ohne Festlegung werden Ausgaben NICHT als Werbungskosten "
                "angesetzt; Einnahmen zählen vorsichtshalber als sonstige "
                "Einnahme. Der Prüfbericht meldet die Kategorie.")
        else:
            self._erklaerung.setText(steuer.STEUER_ARTEN[art].hinweis)

    def _speichern(self) -> None:
        try:
            prozent = steuer.prozent_parsen(self._prozent.text())
            ausnahmen = []
            for index, haus in enumerate(self._haeuser):
                item = self._tabelle.item(index, 1)
                ausnahmen.append((haus["id"], steuer.prozent_parsen(
                    item.text() if item else "")))
            stammdaten.kategorie_steuer_setzen(
                self._verbindung, self._kategorie_id, self._art.currentData(),
                prozent, self._konto.text(),
            )
            for haus_id, wert in ausnahmen:
                stammdaten.haus_anteil_setzen(
                    self._verbindung, self._kategorie_id, haus_id, wert)
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.accept()


# =========================================================================
# Haus
# =========================================================================


class HausSteuerDialog(QDialog):
    """Anlage-V-, AfA-, Nebenkosten- und DATEV-Daten eines Hauses."""

    def __init__(
        self, verbindung: sqlite3.Connection, objekt_id: int, parent=None
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._objekt_id = objekt_id
        haus = verbindung.execute(
            "SELECT * FROM objekte WHERE id = ?", (objekt_id,)
        ).fetchone()
        self.setWindowTitle(f"Steuer-Daten: {haus['name']}")
        self.setModal(True)
        self.resize(560, 420)

        layout = QVBoxLayout(self)
        formular = QFormLayout()
        self._adresse = QLineEdit(haus["adresse"] or "")
        self._adresse.setPlaceholderText("Straße Nr., PLZ Ort")
        formular.addRow("Lage (Anlage V):", self._adresse)
        self._flaeche = QLineEdit(
            "" if not haus["gesamtflaeche"] else
            betrag_formatieren(haus["gesamtflaeche"]))
        self._flaeche.setToolTip(
            "Gesamte Wohnfläche des Hauses. Nötig, damit Kosten für "
            "Leerstand in der Nebenkostenabrechnung beim Vermieter bleiben.")
        formular.addRow("Gesamtwohnfläche (m²):", self._flaeche)
        self._kostenstelle = QLineEdit(haus["kostenstelle"] or "")
        self._kostenstelle.setPlaceholderText(
            "leer = aus dem Hausnamen gebildet")
        formular.addRow("DATEV-Kostenstelle:", self._kostenstelle)
        layout.addLayout(formular)

        afa = QGroupBox("Gebäude-AfA (aus Kaufvertrag oder Vorjahres-"
                        "Erklärung; im Zweifel beim Steuerberater erfragen)")
        afa_formular = QFormLayout(afa)
        self._afa_aktiv = QCheckBox("Gebäude-AfA erfassen")
        self._afa_aktiv.setChecked(bool(haus["afa_bemessung"]))
        afa_formular.addRow(self._afa_aktiv)
        self._bemessung = QLineEdit(
            "" if not haus["afa_bemessung"] else
            betrag_formatieren(haus["afa_bemessung"]))
        self._bemessung.setToolTip(
            "Nur der Gebäudeanteil der Anschaffungs-/Herstellungskosten "
            "(ohne Grund und Boden), inkl. anteiliger Nebenkosten.")
        afa_formular.addRow("Bemessungsgrundlage (€):", self._bemessung)
        self._beginn = QDateEdit()
        self._beginn.setCalendarPopup(True)
        self._beginn.setDisplayFormat("dd.MM.yyyy")
        self._beginn.setDate(
            QDate.fromString(haus["afa_beginn"], "yyyy-MM-dd")
            if haus["afa_beginn"] else QDate(2000, 1, 1))
        afa_formular.addRow("Anschaffung / Fertigstellung:", self._beginn)
        self._satz = QComboBox()
        self._satz.setEditable(True)
        for satz in ("2", "2,5", "3", "4"):
            self._satz.addItem(satz)
        aktueller_satz = steuer.dezimal(haus["afa_satz"])
        self._satz.setCurrentText(
            steuer.prozent_formatieren(aktueller_satz).replace(" %", "")
            if aktueller_satz else "2")
        self._satz.setToolTip(
            "Linear: 2 % (Fertigstellung 1925–2022), 2,5 % (vor 1925), "
            "3 % (ab 2023). Abweichend nur mit Gutachten.")
        afa_formular.addRow("AfA-Satz (% pro Jahr):", self._satz)
        layout.addWidget(afa)

        knoepfe = QDialogButtonBox(QDialogButtonBox.Ok
                                   | QDialogButtonBox.Cancel)
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _speichern(self) -> None:
        try:
            flaeche = _zahl_oder_none(self._flaeche.text())
            if self._afa_aktiv.isChecked():
                bemessung = betrag_parsen(self._bemessung.text())
                beginn = self._beginn.date().toString("yyyy-MM-dd")
                satz = steuer.prozent_parsen(self._satz.currentText())
            else:
                bemessung = beginn = satz = None
            stammdaten.objekt_steuerdaten_setzen(
                self._verbindung, self._objekt_id, self._adresse.text(),
                flaeche, bemessung, beginn, satz, self._kostenstelle.text(),
            )
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.accept()


# =========================================================================
# Prüfbericht
# =========================================================================


class PruefberichtDialog(QDialog):
    """Zeigt den Prüfbericht eines Jahres mit Korrekturmöglichkeiten."""

    def __init__(
        self, verbindung: sqlite3.Connection, jahr: int, parent=None
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._jahr = jahr
        self.setWindowTitle(f"Prüfbericht {jahr}")
        self.setModal(True)
        self.resize(1100, 620)

        layout = QVBoxLayout(self)
        self._zusammenfassung = QLabel()
        self._zusammenfassung.setWordWrap(True)
        layout.addWidget(self._zusammenfassung)

        self._tabelle = QTableWidget(0, 3)
        self._tabelle.setHorizontalHeaderLabels(["Stufe", "Bereich", "Hinweis"])
        self._tabelle.verticalHeader().setVisible(False)
        self._tabelle.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._tabelle.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._tabelle.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self._tabelle.setWordWrap(True)
        kopf = self._tabelle.horizontalHeader()
        kopf.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        kopf.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        kopf.setSectionResizeMode(2, QHeaderView.Stretch)
        layout.addWidget(self._tabelle)

        knopfzeile = QHBoxLayout()
        self._knopf_vorzeichen = QPushButton("Als Erstattung/Rückzahlung "
                                             "umbuchen")
        self._knopf_vorzeichen.clicked.connect(self._vorzeichen)
        self._knopf_jahr = QPushButton("Vorgeschlagenes Steuerjahr setzen")
        self._knopf_jahr.clicked.connect(self._steuerjahr)
        knopf_neu = QPushButton("Neu prüfen")
        knopf_neu.clicked.connect(self._laden)
        for knopf in (self._knopf_vorzeichen, self._knopf_jahr, knopf_neu):
            knopfzeile.addWidget(knopf)
        knopfzeile.addStretch()
        schliessen = QPushButton("Schließen")
        schliessen.clicked.connect(self.accept)
        knopfzeile.addWidget(schliessen)
        layout.addLayout(knopfzeile)

        self._hinweise: list[dict] = []
        self._laden()

    def _laden(self) -> None:
        self._hinweise = steuer.pruefen(self._verbindung, self._jahr)
        zahl = {s: sum(1 for h in self._hinweise if h["stufe"] == s)
                for s in (steuer.FEHLER, steuer.WARNUNG, steuer.INFO)}
        if not self._hinweise:
            text = "Keine Auffälligkeiten gefunden."
        else:
            text = (f"{zahl[steuer.FEHLER]} Fehler (verfälschen das Ergebnis),"
                    f" {zahl[steuer.WARNUNG]} zu prüfen, "
                    f"{zahl[steuer.INFO]} Hinweise. Fehler vor dem Export "
                    "beheben. Zeilen markieren und unten korrigieren.")
        self._zusammenfassung.setText(text)
        self._tabelle.setRowCount(len(self._hinweise))
        for zeile, h in enumerate(self._hinweise):
            for spalte, wert in enumerate(
                    (steuer.STUFEN_TEXT[h["stufe"]], h["bereich"], h["text"])):
                item = QTableWidgetItem(wert)
                item.setBackground(_STUFE_FARBE[h["stufe"]])
                self._tabelle.setItem(zeile, spalte, item)
        self._tabelle.resizeRowsToContents()

    def _markierte(self, aktion: str) -> list[dict]:
        zeilen = sorted({i.row() for i in self._tabelle.selectedIndexes()})
        return [self._hinweise[z] for z in zeilen
                if self._hinweise[z]["aktion"] == aktion]

    def _vorzeichen(self) -> None:
        auswahl = self._markierte("vorzeichen")
        if not auswahl:
            QMessageBox.information(
                self, "Nichts passend markiert",
                "Bitte Zeilen aus dem Bereich „Vorzeichen“ markieren.")
            return
        for h in auswahl:
            for buchung_id in h["buchung_ids"]:
                steuer.vorzeichen_umkehren(self._verbindung, buchung_id)
        self._laden()

    def _steuerjahr(self) -> None:
        auswahl = self._markierte("steuerjahr")
        if not auswahl:
            QMessageBox.information(
                self, "Nichts passend markiert",
                "Bitte Zeilen aus dem Bereich „§ 11 EStG“ markieren.")
            return
        antwort = QMessageBox.question(
            self, "Steuerjahr ändern",
            f"{len(auswahl)} Buchung(en) dem vorgeschlagenen Steuerjahr "
            "zuordnen? Nur richtig, wenn die Zahlung für dieses Jahr fällig "
            "war (10-Tage-Regel).",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if antwort != QMessageBox.Yes:
            return
        for h in auswahl:
            for buchung_id in h["buchung_ids"]:
                steuer.steuerjahr_setzen(self._verbindung, buchung_id,
                                         h["wert"])
        self._laden()


# =========================================================================
# Export-Einstellungen
# =========================================================================


class ExportEinstellungenDialog(QDialog):
    """DATEV-Stammdaten und Zeilennummern der Anlage V."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setWindowTitle("Export-Einstellungen")
        self.setModal(True)
        self.resize(760, 600)
        einst = datev.einstellungen_laden(verbindung)

        layout = QVBoxLayout(self)
        reiter = QTabWidget()
        layout.addWidget(reiter)

        # --- DATEV ---
        seite = QWidget()
        formular = QFormLayout(seite)
        formular.addRow(QLabel(
            "Berater- und Mandantennummer bekommst du vom Steuerberater. "
            "Die Sachkonten sind Vorschläge ohne Gewähr – vor dem ersten "
            "Import mit dem Steuerberater abstimmen."))
        self._berater = QLineEdit(einst["berater"])
        formular.addRow("Beraternummer:", self._berater)
        self._mandant = QLineEdit(einst["mandant"])
        formular.addRow("Mandantennummer:", self._mandant)
        self._skr = QComboBox()
        self._skr.addItem("SKR03", "03")
        self._skr.addItem("SKR04", "04")
        self._skr.setCurrentIndex(max(self._skr.findData(einst["skr"]), 0))
        formular.addRow("Kontenrahmen:", self._skr)
        self._bank = QLineEdit(einst["bank"])
        formular.addRow("Bankkonto:", self._bank)
        self._privat = QLineEdit(einst["privat"])
        formular.addRow("Privatkonto (nicht abziehbare Anteile):",
                        self._privat)
        self._neutral = QLineEdit(einst["neutral"])
        formular.addRow("Konto für Umbuchungen/Kaution:", self._neutral)
        self._konten: dict[str, QLineEdit] = {}
        for art in steuer.STEUER_ARTEN_REIHENFOLGE:
            if art in ("neutral",):
                continue
            schluessel = "privat_art" if art == "privat" else art
            feld = QLineEdit(einst["konten"].get(schluessel, ""))
            self._konten[schluessel] = feld
            formular.addRow(f"{steuer.STEUER_ARTEN[art].bezeichnung}:", feld)
        feld = QLineEdit(einst["konten"].get("ungeklaert", ""))
        self._konten["ungeklaert"] = feld
        formular.addRow("Ungeklärte Kategorien (Sammelkonto):", feld)
        self._skr.activated.connect(self._kontenvorschlag)
        reiter.addTab(seite, "DATEV")

        # --- Anlage V ---
        seite2 = QWidget()
        v = QVBoxLayout(seite2)
        v.addWidget(QLabel(
            "Zeilennummern des amtlichen Vordrucks. Sie ändern sich häufig "
            "von Jahr zu Jahr – vor dem Übertrag in ELSTER mit dem Vordruck "
            "des Steuerjahres abgleichen und hier anpassen. "
            f"({steuer.ZEILEN_STAND})"))
        self._zeilen = QTableWidget(len(steuer.POSITIONEN), 2)
        self._zeilen.setHorizontalHeaderLabels(["Position", "Zeile"])
        self._zeilen.verticalHeader().setVisible(False)
        self._zeilen.horizontalHeader().setSectionResizeMode(
            0, QHeaderView.Stretch)
        for index, pos in enumerate(steuer.POSITIONEN):
            name = QTableWidgetItem(pos.bezeichnung)
            name.setFlags(name.flags() & ~Qt.ItemIsEditable)
            self._zeilen.setItem(index, 0, name)
            self._zeilen.setItem(index, 1, QTableWidgetItem(
                steuer.zeilennummer(verbindung, pos.schluessel)))
        v.addWidget(self._zeilen)
        reiter.addTab(seite2, "Anlage V – Zeilen")

        knoepfe = QDialogButtonBox(QDialogButtonBox.Ok
                                   | QDialogButtonBox.Cancel)
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _kontenvorschlag(self, _index: int) -> None:
        """Füllt nach Wechsel des Kontenrahmens die Kontenvorschläge ein."""
        vorschlag = datev.STANDARDKONTEN[self._skr.currentData()]
        self._bank.setText(vorschlag["bank"])
        self._privat.setText(vorschlag["privat"])
        self._neutral.setText(vorschlag["neutral"])
        for schluessel, feld in self._konten.items():
            feld.setText(vorschlag.get(schluessel, ""))

    def _speichern(self) -> None:
        try:
            datev.einstellungen_speichern(self._verbindung, {
                "berater": self._berater.text(),
                "mandant": self._mandant.text(),
                "skr": self._skr.currentData(),
                "bank": self._bank.text(),
                "privat": self._privat.text(),
                "neutral": self._neutral.text(),
                "konten": {k: f.text() for k, f in self._konten.items()},
            })
            for index, pos in enumerate(steuer.POSITIONEN):
                item = self._zeilen.item(index, 1)
                steuer.zeilennummer_setzen(self._verbindung, pos.schluessel,
                                           item.text() if item else "")
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.accept()
