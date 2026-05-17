"""Stammdatenverwaltung: Häuser, Mieter und Kategorien pflegen.

Der Bereich besteht aus drei Unterreitern. Beim Wechsel eines Reiters
wird dessen Inhalt neu geladen, damit z. B. ein neu angelegtes Haus
sofort in der Mieter-Auswahl erscheint.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import QDate, Qt
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
    QInputDialog,
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
from src.utils.eingaben import (
    ValidierungsFehler,
    betrag_formatieren,
    betrag_parsen,
    datum_anzeigen,
)


def _tabelle_vorbereiten(tabelle: QTableWidget) -> None:
    """Setzt die gemeinsamen Tabelleneinstellungen (nur Lesen, Zeilenauswahl)."""
    tabelle.setEditTriggers(QAbstractItemView.NoEditTriggers)
    tabelle.setSelectionBehavior(QAbstractItemView.SelectRows)
    tabelle.setSelectionMode(QAbstractItemView.SingleSelection)
    tabelle.verticalHeader().setVisible(False)
    tabelle.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)


# =========================================================================
# Reiter: Häuser
# =========================================================================


class HaeuserTab(QWidget):
    """Liste der Häuser mit Anlegen, Umbenennen und Deaktivieren."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        self._tabelle = QTableWidget(0, 2)
        self._tabelle.setHorizontalHeaderLabels(["Haus", "Status"])
        _tabelle_vorbereiten(self._tabelle)
        layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        knopf_neu = QPushButton("Neues Haus")
        knopf_neu.clicked.connect(self._neues_haus)
        knopf_umbenennen = QPushButton("Umbenennen")
        knopf_umbenennen.clicked.connect(self._umbenennen)
        knopf_status = QPushButton("Status ändern")
        knopf_status.clicked.connect(self._status_aendern)
        knopfleiste.addWidget(knopf_neu)
        knopfleiste.addWidget(knopf_umbenennen)
        knopfleiste.addWidget(knopf_status)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Hausliste neu aus der Datenbank."""
        haeuser = stammdaten.objekte_laden(self._verbindung)
        self._tabelle.setRowCount(len(haeuser))
        for zeile, haus in enumerate(haeuser):
            name_item = QTableWidgetItem(haus["name"])
            name_item.setData(Qt.UserRole, haus["id"])
            status_text = "aktiv" if haus["aktiv"] else "inaktiv"
            self._tabelle.setItem(zeile, 0, name_item)
            self._tabelle.setItem(zeile, 1, QTableWidgetItem(status_text))

    def _ausgewaehltes_haus(self) -> tuple[int, str, bool] | None:
        """Liefert (id, name, aktiv) der markierten Zeile oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        objekt_id = self._tabelle.item(zeile, 0).data(Qt.UserRole)
        name = self._tabelle.item(zeile, 0).text()
        aktiv = self._tabelle.item(zeile, 1).text() == "aktiv"
        return objekt_id, name, aktiv

    def _neues_haus(self) -> None:
        name, ok = QInputDialog.getText(self, "Neues Haus", "Name des Hauses:")
        if not ok:
            return
        try:
            stammdaten.objekt_anlegen(self._verbindung, name)
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _umbenennen(self) -> None:
        auswahl = self._ausgewaehltes_haus()
        if auswahl is None:
            QMessageBox.information(self, "Kein Haus gewählt",
                                    "Bitte zuerst ein Haus auswählen.")
            return
        objekt_id, alter_name, _ = auswahl
        neuer_name, ok = QInputDialog.getText(
            self, "Haus umbenennen", "Neuer Name:", text=alter_name
        )
        if not ok:
            return
        try:
            stammdaten.objekt_umbenennen(self._verbindung, objekt_id, neuer_name)
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _status_aendern(self) -> None:
        auswahl = self._ausgewaehltes_haus()
        if auswahl is None:
            QMessageBox.information(self, "Kein Haus gewählt",
                                    "Bitte zuerst ein Haus auswählen.")
            return
        objekt_id, name, aktiv = auswahl
        try:
            stammdaten.objekt_aktiv_setzen(self._verbindung, objekt_id, not aktiv)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()


# =========================================================================
# Reiter: Mieter
# =========================================================================


class MieterTab(QWidget):
    """Mieterliste je Haus mit Anlegen und Bearbeiten."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        auswahlzeile = QHBoxLayout()
        auswahlzeile.addWidget(QLabel("Haus:"))
        self._haus_auswahl = QComboBox()
        self._haus_auswahl.currentIndexChanged.connect(self._mieter_laden)
        auswahlzeile.addWidget(self._haus_auswahl, stretch=1)
        layout.addLayout(auswahlzeile)

        self._tabelle = QTableWidget(0, 6)
        self._tabelle.setHorizontalHeaderLabels(
            ["Name", "Kaltmiete", "Nebenkosten", "Rücklage",
             "Aktiv von", "Aktiv bis"]
        )
        _tabelle_vorbereiten(self._tabelle)
        layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        knopf_neu = QPushButton("Neuer Mieter")
        knopf_neu.clicked.connect(self._neuer_mieter)
        knopf_bearbeiten = QPushButton("Bearbeiten")
        knopf_bearbeiten.clicked.connect(self._mieter_bearbeiten)
        knopfleiste.addWidget(knopf_neu)
        knopfleiste.addWidget(knopf_bearbeiten)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Hausauswahl neu und behält die aktuelle Auswahl bei."""
        bisher = self._haus_auswahl.currentData()
        self._haus_auswahl.blockSignals(True)
        self._haus_auswahl.clear()
        for haus in stammdaten.objekte_laden(self._verbindung):
            beschriftung = haus["name"]
            if not haus["aktiv"]:
                beschriftung += "  (inaktiv)"
            self._haus_auswahl.addItem(beschriftung, haus["id"])
        if bisher is not None:
            index = self._haus_auswahl.findData(bisher)
            if index >= 0:
                self._haus_auswahl.setCurrentIndex(index)
        self._haus_auswahl.blockSignals(False)
        self._mieter_laden()

    def _aktuelles_haus(self) -> int | None:
        """Liefert die ID des gewählten Hauses oder None."""
        return self._haus_auswahl.currentData()

    def _mieter_laden(self) -> None:
        """Füllt die Mietertabelle für das gewählte Haus."""
        self._tabelle.setRowCount(0)
        objekt_id = self._aktuelles_haus()
        if objekt_id is None:
            return
        mieter = stammdaten.mieter_laden(self._verbindung, objekt_id)
        self._tabelle.setRowCount(len(mieter))
        for zeile, person in enumerate(mieter):
            name_item = QTableWidgetItem(person["name"])
            name_item.setData(Qt.UserRole, person["id"])
            werte = [
                name_item,
                QTableWidgetItem(betrag_formatieren(person["kaltmiete"]) + " €"),
                QTableWidgetItem(betrag_formatieren(person["nebenkosten"]) + " €"),
                QTableWidgetItem(betrag_formatieren(person["ruecklage"]) + " €"),
                QTableWidgetItem(datum_anzeigen(person["aktiv_von"])),
                QTableWidgetItem(datum_anzeigen(person["aktiv_bis"])),
            ]
            for spalte, item in enumerate(werte):
                self._tabelle.setItem(zeile, spalte, item)

    def _ausgewaehlter_mieter(self) -> int | None:
        """Liefert die ID des markierten Mieters oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        return self._tabelle.item(zeile, 0).data(Qt.UserRole)

    def _neuer_mieter(self) -> None:
        objekt_id = self._aktuelles_haus()
        if objekt_id is None:
            QMessageBox.information(
                self, "Kein Haus", "Bitte zuerst ein Haus auswählen "
                "oder im Reiter „Häuser“ anlegen."
            )
            return
        dialog = MieterDialog(self._verbindung, objekt_id, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self._mieter_laden()

    def _mieter_bearbeiten(self) -> None:
        mieter_id = self._ausgewaehlter_mieter()
        if mieter_id is None:
            QMessageBox.information(self, "Kein Mieter gewählt",
                                    "Bitte zuerst einen Mieter auswählen.")
            return
        objekt_id = self._aktuelles_haus()
        dialog = MieterDialog(
            self._verbindung, objekt_id, mieter_id=mieter_id, parent=self
        )
        if dialog.exec() == QDialog.Accepted:
            self._mieter_laden()


class MieterDialog(QDialog):
    """Formular zum Anlegen oder Bearbeiten eines Mieters."""

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        objekt_id: int,
        mieter_id: int | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._objekt_id = objekt_id
        self._mieter_id = mieter_id
        self.setModal(True)
        self.setWindowTitle(
            "Mieter bearbeiten" if mieter_id else "Neuer Mieter"
        )

        layout = QVBoxLayout(self)
        formular = QFormLayout()

        self._feld_name = QLineEdit()
        self._feld_kaltmiete = QLineEdit("0,00")
        self._feld_nebenkosten = QLineEdit("0,00")
        self._feld_ruecklage = QLineEdit("0,00")
        formular.addRow("Name:", self._feld_name)
        formular.addRow("Kaltmiete (€):", self._feld_kaltmiete)
        formular.addRow("Nebenkosten (€):", self._feld_nebenkosten)
        formular.addRow("Rücklage (€):", self._feld_ruecklage)

        self._feld_von = QDateEdit()
        self._feld_von.setCalendarPopup(True)
        self._feld_von.setDisplayFormat("dd.MM.yyyy")
        self._feld_von.setDate(QDate.currentDate())
        formular.addRow("Aktiv von:", self._feld_von)

        self._unbefristet = QCheckBox("unbefristet")
        self._unbefristet.setChecked(True)
        self._unbefristet.toggled.connect(
            lambda an: self._feld_bis.setEnabled(not an)
        )
        self._feld_bis = QDateEdit()
        self._feld_bis.setCalendarPopup(True)
        self._feld_bis.setDisplayFormat("dd.MM.yyyy")
        self._feld_bis.setDate(QDate.currentDate())
        self._feld_bis.setEnabled(False)
        bis_zeile = QHBoxLayout()
        bis_zeile.addWidget(self._feld_bis)
        bis_zeile.addWidget(self._unbefristet)
        formular.addRow("Aktiv bis:", bis_zeile)

        layout.addLayout(formular)

        if mieter_id is not None:
            self._daten_laden()

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _daten_laden(self) -> None:
        """Füllt das Formular mit den Werten eines bestehenden Mieters."""
        zeile = self._verbindung.execute(
            "SELECT name, kaltmiete, nebenkosten, ruecklage, aktiv_von, "
            "aktiv_bis FROM mieter WHERE id = ?",
            (self._mieter_id,),
        ).fetchone()
        if zeile is None:
            return
        self._feld_name.setText(zeile["name"])
        self._feld_kaltmiete.setText(betrag_formatieren(zeile["kaltmiete"]))
        self._feld_nebenkosten.setText(betrag_formatieren(zeile["nebenkosten"]))
        self._feld_ruecklage.setText(betrag_formatieren(zeile["ruecklage"]))
        if zeile["aktiv_von"]:
            self._feld_von.setDate(
                QDate.fromString(zeile["aktiv_von"], "yyyy-MM-dd")
            )
        if zeile["aktiv_bis"]:
            self._unbefristet.setChecked(False)
            self._feld_bis.setEnabled(True)
            self._feld_bis.setDate(
                QDate.fromString(zeile["aktiv_bis"], "yyyy-MM-dd")
            )

    def _speichern(self) -> None:
        """Validiert die Eingaben und schreibt den Mieter in die Datenbank."""
        try:
            kaltmiete = betrag_parsen(self._feld_kaltmiete.text())
            nebenkosten = betrag_parsen(self._feld_nebenkosten.text())
            ruecklage = betrag_parsen(self._feld_ruecklage.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return

        aktiv_von = self._feld_von.date().toString("yyyy-MM-dd")
        aktiv_bis: str | None = None
        if not self._unbefristet.isChecked():
            aktiv_bis = self._feld_bis.date().toString("yyyy-MM-dd")
            if aktiv_bis < aktiv_von:
                QMessageBox.warning(
                    self, "Zeitraum ungültig",
                    "Das Enddatum darf nicht vor dem Startdatum liegen."
                )
                return

        try:
            if self._mieter_id is None:
                stammdaten.mieter_anlegen(
                    self._verbindung, self._objekt_id,
                    self._feld_name.text(), kaltmiete, nebenkosten,
                    ruecklage, aktiv_von, aktiv_bis,
                )
            else:
                stammdaten.mieter_aktualisieren(
                    self._verbindung, self._mieter_id,
                    self._feld_name.text(), kaltmiete, nebenkosten,
                    ruecklage, aktiv_von, aktiv_bis,
                )
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return

        self.accept()


# =========================================================================
# Reiter: Kategorien
# =========================================================================


class _KategorieListe(QWidget):
    """Liste der Kategorien eines Typs ('ausgabe' oder 'einnahme')."""

    def __init__(
        self, verbindung: sqlite3.Connection, typ: str, titel: str, parent=None
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._typ = typ

        layout = QVBoxLayout(self)
        gruppe = QGroupBox(titel)
        gruppen_layout = QVBoxLayout(gruppe)

        self._tabelle = QTableWidget(0, 2)
        self._tabelle.setHorizontalHeaderLabels(["Kategorie", "Status"])
        _tabelle_vorbereiten(self._tabelle)
        gruppen_layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        knopf_neu = QPushButton("Neu")
        knopf_neu.clicked.connect(self._neue_kategorie)
        knopf_status = QPushButton("Status ändern")
        knopf_status.clicked.connect(self._status_aendern)
        knopfleiste.addWidget(knopf_neu)
        knopfleiste.addWidget(knopf_status)
        knopfleiste.addStretch()
        gruppen_layout.addLayout(knopfleiste)

        layout.addWidget(gruppe)
        layout.setContentsMargins(0, 0, 0, 0)
        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Kategorienliste neu."""
        kategorien = stammdaten.kategorien_laden(self._verbindung, self._typ)
        self._tabelle.setRowCount(len(kategorien))
        for zeile, kategorie in enumerate(kategorien):
            name_item = QTableWidgetItem(kategorie["name"])
            name_item.setData(Qt.UserRole, kategorie["id"])
            status = "aktiv" if kategorie["aktiv"] else "inaktiv"
            self._tabelle.setItem(zeile, 0, name_item)
            self._tabelle.setItem(zeile, 1, QTableWidgetItem(status))

    def _ausgewaehlt(self) -> tuple[int, bool] | None:
        """Liefert (id, aktiv) der markierten Kategorie oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        kategorie_id = self._tabelle.item(zeile, 0).data(Qt.UserRole)
        aktiv = self._tabelle.item(zeile, 1).text() == "aktiv"
        return kategorie_id, aktiv

    def _neue_kategorie(self) -> None:
        name, ok = QInputDialog.getText(
            self, "Neue Kategorie", "Name der Kategorie:"
        )
        if not ok:
            return
        try:
            stammdaten.kategorie_anlegen(self._verbindung, name, self._typ)
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _status_aendern(self) -> None:
        auswahl = self._ausgewaehlt()
        if auswahl is None:
            QMessageBox.information(self, "Keine Kategorie gewählt",
                                    "Bitte zuerst eine Kategorie auswählen.")
            return
        kategorie_id, aktiv = auswahl
        try:
            stammdaten.kategorie_aktiv_setzen(
                self._verbindung, kategorie_id, not aktiv
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()


class KategorienTab(QWidget):
    """Kategorienverwaltung, getrennt nach Ausgaben und Einnahmen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        self._ausgaben = _KategorieListe(verbindung, "ausgabe", "Ausgaben")
        self._einnahmen = _KategorieListe(verbindung, "einnahme", "Einnahmen")
        layout.addWidget(self._ausgaben)
        layout.addWidget(self._einnahmen)

    def aktualisieren(self) -> None:
        """Lädt beide Kategorienlisten neu."""
        self._ausgaben.aktualisieren()
        self._einnahmen.aktualisieren()


# =========================================================================
# Container: Stammdaten-Seite mit den drei Unterreitern
# =========================================================================


class StammdatenSeite(QWidget):
    """Bündelt Häuser-, Mieter- und Kategorien-Reiter."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        self._reiter = QTabWidget()
        self._haeuser = HaeuserTab(verbindung)
        self._mieter = MieterTab(verbindung)
        self._kategorien = KategorienTab(verbindung)
        self._reiter.addTab(self._haeuser, "Häuser")
        self._reiter.addTab(self._mieter, "Mieter")
        self._reiter.addTab(self._kategorien, "Kategorien")
        self._reiter.currentChanged.connect(self._reiter_gewechselt)
        layout.addWidget(self._reiter)

    def _reiter_gewechselt(self, index: int) -> None:
        """Lädt den jetzt sichtbaren Reiter neu (Querverweise aktuell halten)."""
        widget = self._reiter.widget(index)
        if hasattr(widget, "aktualisieren"):
            widget.aktualisieren()
