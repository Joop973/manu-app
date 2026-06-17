"""Stammdatenverwaltung: Häuser, Mieter und Kategorien pflegen.

Der Bereich besteht aus drei Unterreitern. Tabellen sind sortierbar,
inaktive Einträge lassen sich ausblenden, und vor dem Deaktivieren
wird eine Bestätigung eingeholt.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from PySide6.QtCore import QDate, Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from src.db import muster, stammdaten
from src.ui.tabelle import SortierItem, tabelle_vorbereiten
from src.utils.eingaben import (
    ValidierungsFehler,
    betrag_formatieren,
    betrag_parsen,
    datum_anzeigen,
)

# Eintrag im Combo, der „alle Häuser" repräsentiert.
ALLE_HAEUSER = "— Alle Häuser —"


def _deaktivieren_bestaetigt(widget: QWidget, bezeichnung: str) -> bool:
    """Fragt vor dem Deaktivieren eines Eintrags nach."""
    antwort = QMessageBox.question(
        widget,
        "Deaktivieren bestätigen",
        f"„{bezeichnung}“ wirklich deaktivieren?",
        QMessageBox.Yes | QMessageBox.No,
        QMessageBox.No,
    )
    return antwort == QMessageBox.Yes


# =========================================================================
# Reiter: Häuser
# =========================================================================


class HaeuserTab(QWidget):
    """Liste der Häuser mit Anlegen, Umbenennen und Deaktivieren."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        self._nur_aktive = QCheckBox("Nur aktive anzeigen")
        self._nur_aktive.toggled.connect(self.aktualisieren)
        layout.addWidget(self._nur_aktive)

        self._tabelle = QTableWidget(0, 3)
        self._tabelle.setHorizontalHeaderLabels(
            ["Haus", "Umlageschlüssel", "Status"]
        )
        tabelle_vorbereiten(self._tabelle)
        layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        for beschriftung, methode in (
            ("Neues Haus", self._neues_haus),
            ("Umbenennen", self._umbenennen),
            ("Umlageschlüssel …", self._umlageschluessel_aendern),
            ("Status ändern", self._status_aendern),
        ):
            knopf = QPushButton(beschriftung)
            knopf.clicked.connect(methode)
            knopfleiste.addWidget(knopf)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Hausliste neu aus der Datenbank."""
        haeuser = stammdaten.objekte_laden(
            self._verbindung, nur_aktive=self._nur_aktive.isChecked()
        )
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(haeuser))
        for zeile, haus in enumerate(haeuser):
            name_item = QTableWidgetItem(haus["name"])
            name_item.setData(Qt.UserRole, haus["id"])
            name_item.setData(Qt.UserRole + 1, haus["umlageschluessel"])
            schluessel_text = stammdaten.UMLAGESCHLUESSEL.get(
                haus["umlageschluessel"], haus["umlageschluessel"]
            )
            status = "aktiv" if haus["aktiv"] else "inaktiv"
            self._tabelle.setItem(zeile, 0, name_item)
            self._tabelle.setItem(zeile, 1, QTableWidgetItem(schluessel_text))
            self._tabelle.setItem(zeile, 2, QTableWidgetItem(status))
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehltes_haus(self) -> tuple[int, str, bool, str] | None:
        """Liefert (id, name, aktiv, umlageschluessel) der Zeile oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        item = self._tabelle.item(zeile, 0)
        objekt_id = item.data(Qt.UserRole)
        schluessel = item.data(Qt.UserRole + 1)
        name = item.text()
        aktiv = self._tabelle.item(zeile, 2).text() == "aktiv"
        return objekt_id, name, aktiv, schluessel

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
        objekt_id, alter_name, _, _ = auswahl
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
        objekt_id, name, aktiv, _ = auswahl
        if aktiv and not _deaktivieren_bestaetigt(self, name):
            return
        try:
            stammdaten.objekt_aktiv_setzen(self._verbindung, objekt_id, not aktiv)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _umlageschluessel_aendern(self) -> None:
        """Legt den Umlageschlüssel des markierten Hauses fest."""
        auswahl = self._ausgewaehltes_haus()
        if auswahl is None:
            QMessageBox.information(self, "Kein Haus gewählt",
                                    "Bitte zuerst ein Haus auswählen.")
            return
        objekt_id, name, _, aktueller = auswahl
        schluessel_keys = list(stammdaten.UMLAGESCHLUESSEL.keys())
        beschriftungen = list(stammdaten.UMLAGESCHLUESSEL.values())
        vorauswahl = schluessel_keys.index(aktueller) \
            if aktueller in schluessel_keys else 0
        wahl, ok = QInputDialog.getItem(
            self, "Umlageschlüssel", f"Umlageschlüssel für „{name}“:",
            beschriftungen, vorauswahl, editable=False,
        )
        if not ok:
            return
        schluessel = schluessel_keys[beschriftungen.index(wahl)]
        try:
            stammdaten.objekt_umlageschluessel_setzen(
                self._verbindung, objekt_id, schluessel
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.warning(self, "Fehler", str(fehler))
            return
        self.aktualisieren()


# =========================================================================
# Reiter: Mieter
# =========================================================================


class MieterTab(QWidget):
    """Mieterliste je Haus (oder über alle Häuser) mit Anlegen/Bearbeiten."""

    # Spaltenreihenfolge der Tabelle.
    SPALTE_HAUS = 0
    SPALTE_NAME = 1

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

        self._tabelle = QTableWidget(0, 7)
        self._tabelle.setHorizontalHeaderLabels(
            ["Haus", "Name", "Kaltmiete", "Nebenkosten", "Rücklage",
             "Aktiv von", "Aktiv bis"]
        )
        tabelle_vorbereiten(self._tabelle)
        self._tabelle.itemDoubleClicked.connect(
            lambda *_: self._mieter_bearbeiten()
        )
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
        self._haus_auswahl.addItem(ALLE_HAEUSER, None)
        for haus in stammdaten.objekte_laden(self._verbindung):
            beschriftung = haus["name"]
            if not haus["aktiv"]:
                beschriftung += "  (inaktiv)"
            self._haus_auswahl.addItem(beschriftung, haus["id"])
        index = self._haus_auswahl.findData(bisher)
        self._haus_auswahl.setCurrentIndex(max(index, 0))
        self._haus_auswahl.blockSignals(False)
        self._mieter_laden()

    def _aktuelles_haus(self) -> int | None:
        """Liefert die ID des gewählten Hauses oder None bei „alle Häuser"."""
        return self._haus_auswahl.currentData()

    def _mieter_laden(self) -> None:
        """Füllt die Mietertabelle passend zur Hausauswahl."""
        objekt_id = self._aktuelles_haus()
        alle = objekt_id is None
        self._tabelle.setColumnHidden(self.SPALTE_HAUS, not alle)

        if alle:
            mieter = stammdaten.mieter_alle_laden(self._verbindung)
        else:
            mieter = stammdaten.mieter_laden(self._verbindung, objekt_id)

        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(mieter))
        for zeile, person in enumerate(mieter):
            haus_text = person["objekt_name"] if alle else ""
            haus_item = QTableWidgetItem(haus_text)

            name_item = QTableWidgetItem(person["name"])
            name_item.setData(Qt.UserRole, person["id"])
            name_item.setData(Qt.UserRole + 1, person["objekt_id"])

            werte = [
                haus_item,
                name_item,
                _betrag_zelle(person["kaltmiete"]),
                _betrag_zelle(person["nebenkosten"]),
                _betrag_zelle(person["ruecklage"]),
                _datum_zelle(person["aktiv_von"]),
                _datum_zelle(person["aktiv_bis"]),
            ]
            for spalte, item in enumerate(werte):
                self._tabelle.setItem(zeile, spalte, item)
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehlter_mieter(self) -> tuple[int, int] | None:
        """Liefert (mieter_id, objekt_id) des markierten Mieters oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        item = self._tabelle.item(zeile, self.SPALTE_NAME)
        return item.data(Qt.UserRole), item.data(Qt.UserRole + 1)

    def _neuer_mieter(self) -> None:
        objekt_id = self._aktuelles_haus()
        if objekt_id is None:
            QMessageBox.information(
                self, "Kein Haus gewählt",
                "Bitte zuerst ein einzelnes Haus auswählen, "
                "um dort einen Mieter anzulegen."
            )
            return
        dialog = MieterDialog(self._verbindung, objekt_id, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self._mieter_laden()

    def _mieter_bearbeiten(self) -> None:
        auswahl = self._ausgewaehlter_mieter()
        if auswahl is None:
            QMessageBox.information(self, "Kein Mieter gewählt",
                                    "Bitte zuerst einen Mieter auswählen.")
            return
        mieter_id, objekt_id = auswahl
        dialog = MieterDialog(
            self._verbindung, objekt_id, mieter_id=mieter_id, parent=self
        )
        if dialog.exec() == QDialog.Accepted:
            self._mieter_laden()


def _betrag_zelle(wert) -> SortierItem:
    """Erzeugt eine numerisch sortierbare Betragszelle."""
    return SortierItem(betrag_formatieren(wert) + " €", Decimal(str(wert)))


def _datum_zelle(iso_text: str | None) -> SortierItem:
    """Erzeugt eine sortierbare Datumszelle (Sortierung nach ISO-Wert)."""
    return SortierItem(datum_anzeigen(iso_text), iso_text or "")


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

        # Felder für die Nebenkostenabrechnung
        self._feld_wohnflaeche = QLineEdit("0,00")
        formular.addRow("Wohnfläche (m²):", self._feld_wohnflaeche)
        self._feld_personen = QSpinBox()
        self._feld_personen.setRange(1, 99)
        formular.addRow("Personenzahl:", self._feld_personen)

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
            "aktiv_bis, wohnflaeche, personenzahl FROM mieter WHERE id = ?",
            (self._mieter_id,),
        ).fetchone()
        if zeile is None:
            return
        self._feld_name.setText(zeile["name"])
        self._feld_kaltmiete.setText(betrag_formatieren(zeile["kaltmiete"]))
        self._feld_nebenkosten.setText(betrag_formatieren(zeile["nebenkosten"]))
        self._feld_ruecklage.setText(betrag_formatieren(zeile["ruecklage"]))
        self._feld_wohnflaeche.setText(betrag_formatieren(zeile["wohnflaeche"]))
        self._feld_personen.setValue(int(zeile["personenzahl"] or 1))
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
            wohnflaeche = betrag_parsen(self._feld_wohnflaeche.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        personenzahl = self._feld_personen.value()

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
                    wohnflaeche, personenzahl,
                )
            else:
                stammdaten.mieter_aktualisieren(
                    self._verbindung, self._mieter_id,
                    self._feld_name.text(), kaltmiete, nebenkosten,
                    ruecklage, aktiv_von, aktiv_bis,
                    wohnflaeche, personenzahl,
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
        layout.setContentsMargins(0, 0, 0, 0)
        gruppe = QGroupBox(titel)
        gruppen_layout = QVBoxLayout(gruppe)

        self._nur_aktive = QCheckBox("Nur aktive anzeigen")
        self._nur_aktive.toggled.connect(self.aktualisieren)
        gruppen_layout.addWidget(self._nur_aktive)

        self._tabelle = QTableWidget(0, 3)
        self._tabelle.setHorizontalHeaderLabels(
            ["Kategorie", "Status", "Umlagefähig"]
        )
        tabelle_vorbereiten(self._tabelle)
        gruppen_layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        knopf_neu = QPushButton("Neu")
        knopf_neu.clicked.connect(self._neue_kategorie)
        knopf_status = QPushButton("Status ändern")
        knopf_status.clicked.connect(self._status_aendern)
        knopf_umlage = QPushButton("Umlagefähig ändern")
        knopf_umlage.clicked.connect(self._umlagefaehig_aendern)
        knopfleiste.addWidget(knopf_neu)
        knopfleiste.addWidget(knopf_status)
        knopfleiste.addWidget(knopf_umlage)
        knopfleiste.addStretch()
        gruppen_layout.addLayout(knopfleiste)

        layout.addWidget(gruppe)
        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Kategorienliste neu."""
        kategorien = stammdaten.kategorien_laden(
            self._verbindung, self._typ,
            nur_aktive=self._nur_aktive.isChecked(),
        )
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(kategorien))
        for zeile, kategorie in enumerate(kategorien):
            name_item = QTableWidgetItem(kategorie["name"])
            name_item.setData(Qt.UserRole, kategorie["id"])
            name_item.setData(Qt.UserRole + 1, bool(kategorie["umlagefaehig"]))
            status = "aktiv" if kategorie["aktiv"] else "inaktiv"
            umlage = "ja" if kategorie["umlagefaehig"] else "nein"
            self._tabelle.setItem(zeile, 0, name_item)
            self._tabelle.setItem(zeile, 1, QTableWidgetItem(status))
            self._tabelle.setItem(zeile, 2, QTableWidgetItem(umlage))
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehlt(self) -> tuple[int, str, bool, bool] | None:
        """Liefert (id, name, aktiv, umlagefähig) der Kategorie oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        item = self._tabelle.item(zeile, 0)
        kategorie_id = item.data(Qt.UserRole)
        umlagefaehig = bool(item.data(Qt.UserRole + 1))
        name = item.text()
        aktiv = self._tabelle.item(zeile, 1).text() == "aktiv"
        return kategorie_id, name, aktiv, umlagefaehig

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
        kategorie_id, name, aktiv, _ = auswahl
        if aktiv and not _deaktivieren_bestaetigt(self, name):
            return
        try:
            stammdaten.kategorie_aktiv_setzen(
                self._verbindung, kategorie_id, not aktiv
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _umlagefaehig_aendern(self) -> None:
        """Schaltet das Merkmal „umlagefähig" der markierten Kategorie um."""
        auswahl = self._ausgewaehlt()
        if auswahl is None:
            QMessageBox.information(self, "Keine Kategorie gewählt",
                                    "Bitte zuerst eine Kategorie auswählen.")
            return
        kategorie_id, _, _, umlagefaehig = auswahl
        try:
            stammdaten.kategorie_umlagefaehig_setzen(
                self._verbindung, kategorie_id, not umlagefaehig
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
# Reiter: Muster (Lernsystem)
# =========================================================================


class MusterZuordnungDialog(QDialog):
    """Ändert Haus und Kategorie eines gelernten Buchungsmusters."""

    def __init__(
        self, verbindung: sqlite3.Connection, muster_id: int, parent=None
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._muster_id = muster_id
        self.setModal(True)
        self.setWindowTitle("Muster-Zuordnung ändern")

        zeile = next(
            (m for m in muster.muster_uebersicht(verbindung)
             if m["id"] == muster_id),
            None,
        )

        layout = QVBoxLayout(self)
        formular = QFormLayout()
        if zeile is not None:
            formular.addRow("Erkennungstext:",
                            QLabel(zeile["erkennungstext"]))

        self._haus = QComboBox()
        for haus in stammdaten.objekte_laden(verbindung):
            self._haus.addItem(haus["name"], haus["id"])
        self._kategorie = QComboBox()
        for typ, bezeichnung in (("einnahme", "Einnahme"),
                                 ("ausgabe", "Ausgabe")):
            for kategorie in stammdaten.kategorien_laden(verbindung, typ):
                self._kategorie.addItem(
                    f"{kategorie['name']} ({bezeichnung})", kategorie["id"]
                )
        if zeile is not None:
            haus_index = self._haus.findData(zeile["objekt_id"])
            if haus_index >= 0:
                self._haus.setCurrentIndex(haus_index)
            kat_index = self._kategorie.findData(zeile["kategorie_id"])
            if kat_index >= 0:
                self._kategorie.setCurrentIndex(kat_index)

        formular.addRow("Haus:", self._haus)
        formular.addRow("Kategorie:", self._kategorie)
        layout.addLayout(formular)

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _speichern(self) -> None:
        objekt_id = self._haus.currentData()
        kategorie_id = self._kategorie.currentData()
        if objekt_id is None or kategorie_id is None:
            QMessageBox.warning(self, "Auswahl fehlt",
                                "Bitte Haus und Kategorie wählen.")
            return
        try:
            muster.muster_aktualisieren(
                self._verbindung, self._muster_id, objekt_id, kategorie_id
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.accept()


class MusterTab(QWidget):
    """Übersicht der gelernten Buchungsmuster mit Korrektur und Löschen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Gelernte Buchungsmuster für den automatischen PDF-Import."
        ))

        self._tabelle = QTableWidget(0, 4)
        self._tabelle.setHorizontalHeaderLabels(
            ["Erkennungstext", "Haus", "Kategorie", "Gelernt am"]
        )
        tabelle_vorbereiten(self._tabelle)
        self._tabelle.itemDoubleClicked.connect(
            lambda *_: self._zuordnung_aendern()
        )
        layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        knopf_aendern = QPushButton("Zuordnung ändern")
        knopf_aendern.clicked.connect(self._zuordnung_aendern)
        knopf_loeschen = QPushButton("Löschen")
        knopf_loeschen.clicked.connect(self._loeschen)
        knopfleiste.addWidget(knopf_aendern)
        knopfleiste.addWidget(knopf_loeschen)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Musterliste neu."""
        eintraege = muster.muster_uebersicht(self._verbindung)
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(eintraege))
        for zeile, eintrag in enumerate(eintraege):
            text_item = QTableWidgetItem(eintrag["erkennungstext"])
            text_item.setData(Qt.UserRole, eintrag["id"])
            self._tabelle.setItem(zeile, 0, text_item)
            self._tabelle.setItem(
                zeile, 1, QTableWidgetItem(eintrag["objekt_name"] or "—")
            )
            self._tabelle.setItem(
                zeile, 2, QTableWidgetItem(eintrag["kategorie_name"] or "—")
            )
            self._tabelle.setItem(
                zeile, 3, QTableWidgetItem(eintrag["bestaetigt_am"] or "")
            )
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehltes_muster(self) -> int | None:
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        return self._tabelle.item(zeile, 0).data(Qt.UserRole)

    def _zuordnung_aendern(self) -> None:
        muster_id = self._ausgewaehltes_muster()
        if muster_id is None:
            QMessageBox.information(self, "Kein Muster gewählt",
                                    "Bitte zuerst ein Muster auswählen.")
            return
        dialog = MusterZuordnungDialog(self._verbindung, muster_id, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self.aktualisieren()

    def _loeschen(self) -> None:
        muster_id = self._ausgewaehltes_muster()
        if muster_id is None:
            QMessageBox.information(self, "Kein Muster gewählt",
                                    "Bitte zuerst ein Muster auswählen.")
            return
        antwort = QMessageBox.question(
            self, "Muster löschen",
            "Das markierte Buchungsmuster wirklich löschen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            muster.muster_loeschen(self._verbindung, muster_id)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()


# =========================================================================
# Container: Stammdaten-Seite mit den vier Unterreitern
# =========================================================================


class StammdatenSeite(QWidget):
    """Bündelt Häuser-, Mieter-, Kategorien- und Muster-Reiter."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        self._reiter = QTabWidget()
        self._haeuser = HaeuserTab(verbindung)
        self._mieter = MieterTab(verbindung)
        self._kategorien = KategorienTab(verbindung)
        self._muster = MusterTab(verbindung)
        self._regeln = RegelnTab(verbindung)
        self._reiter.addTab(self._haeuser, "Häuser")
        self._reiter.addTab(self._mieter, "Mieter")
        self._reiter.addTab(self._kategorien, "Kategorien")
        self._reiter.addTab(self._muster, "Muster")
        self._reiter.addTab(self._regeln, "Regeln")
        self._reiter.currentChanged.connect(self._reiter_gewechselt)
        layout.addWidget(self._reiter)

    def _reiter_gewechselt(self, index: int) -> None:
        """Lädt den jetzt sichtbaren Reiter neu (Querverweise aktuell halten)."""
        widget = self._reiter.widget(index)
        if hasattr(widget, "aktualisieren"):
            widget.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt den aktuell sichtbaren Reiter neu."""
        self._reiter_gewechselt(self._reiter.currentIndex())


# =========================================================================
# Reiter: Regeln (benutzerdefinierte Auto-Zuordnung)
# =========================================================================


class RegelDialog(QDialog):
    """Anlegen/Bearbeiten einer Auto-Zuordnungs-Regel."""

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        regel_id: int | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        from src.db import regeln
        self._verbindung = verbindung
        self._regel_id = regel_id
        self._regeln = regeln
        self.setModal(True)
        self.setWindowTitle("Regel bearbeiten" if regel_id else "Neue Regel")

        layout = QVBoxLayout(self)
        formular = QFormLayout()
        layout.addWidget(QLabel(
            "Wenn der Empfänger/Verwendungszweck einer Buchung das Muster "
            "enthält, werden Haus, Kategorie und/oder Mieter laut Regel "
            "vorbelegt. Bewusst leer gelassene Felder werden nicht gesetzt."
        ))

        self._feld_muster = QLineEdit()
        self._feld_muster.setPlaceholderText("z. B. HERMESHOF, FINANZKASSE, PAYPAL")
        formular.addRow("Such-Muster:", self._feld_muster)

        self._haus = QComboBox()
        self._haus.addItem("— kein Haus —", None)
        for haus in stammdaten.objekte_laden(verbindung):
            self._haus.addItem(haus["name"], haus["id"])
        self._haus.currentIndexChanged.connect(self._mieter_aktualisieren)
        formular.addRow("Haus:", self._haus)

        self._kategorie = QComboBox()
        self._kategorie.addItem("— keine Kategorie —", None)
        for typ, lbl in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
            for kat in stammdaten.kategorien_laden(verbindung, typ):
                self._kategorie.addItem(f"{kat['name']} ({lbl})", kat["id"])
        formular.addRow("Kategorie:", self._kategorie)

        self._mieter = QComboBox()
        self._mieter.addItem("— kein Mieter —", None)
        formular.addRow("Mieter:", self._mieter)

        layout.addLayout(formular)

        if regel_id is not None:
            self._daten_laden()

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _mieter_aktualisieren(self) -> None:
        bisher = self._mieter.currentData()
        self._mieter.clear()
        self._mieter.addItem("— kein Mieter —", None)
        objekt_id = self._haus.currentData()
        if objekt_id is not None:
            for mieter in stammdaten.mieter_laden(self._verbindung, objekt_id):
                self._mieter.addItem(mieter["name"], mieter["id"])
        idx = self._mieter.findData(bisher)
        if idx >= 0:
            self._mieter.setCurrentIndex(idx)

    def _daten_laden(self) -> None:
        zeile = self._verbindung.execute(
            "SELECT muster, objekt_id, kategorie_id, mieter_id "
            "FROM regeln WHERE id = ?", (self._regel_id,),
        ).fetchone()
        if zeile is None:
            return
        self._feld_muster.setText(zeile["muster"])
        for combo, data in (
            (self._haus, zeile["objekt_id"]),
            (self._kategorie, zeile["kategorie_id"]),
        ):
            idx = combo.findData(data)
            if idx >= 0:
                combo.setCurrentIndex(idx)
        self._mieter_aktualisieren()
        idx = self._mieter.findData(zeile["mieter_id"])
        if idx >= 0:
            self._mieter.setCurrentIndex(idx)

    def _speichern(self) -> None:
        try:
            if self._regel_id is None:
                self._regeln.regel_anlegen(
                    self._verbindung, self._feld_muster.text(),
                    self._haus.currentData(),
                    self._kategorie.currentData(),
                    self._mieter.currentData(),
                )
            else:
                self._regeln.regel_aktualisieren(
                    self._verbindung, self._regel_id, self._feld_muster.text(),
                    self._haus.currentData(),
                    self._kategorie.currentData(),
                    self._mieter.currentData(),
                )
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.accept()


class RegelnTab(QWidget):
    """Liste der benutzerdefinierten Regeln mit Anlegen/Bearbeiten/Löschen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        from src.db import regeln
        self._verbindung = verbindung
        self._regeln = regeln

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Regeln sorgen für eine zuverlässige Auto-Zuordnung beim Import. "
            "Sie wirken vor den gelernten Mustern."
        ))

        self._tabelle = QTableWidget(0, 5)
        self._tabelle.setHorizontalHeaderLabels(
            ["Muster", "Haus", "Kategorie", "Mieter", "Status"]
        )
        tabelle_vorbereiten(self._tabelle)
        layout.addWidget(self._tabelle)

        knopfleiste = QHBoxLayout()
        for beschriftung, methode in (
            ("Neue Regel", self._neu),
            ("Bearbeiten", self._bearbeiten),
            ("Status ändern", self._status_aendern),
            ("Löschen", self._loeschen),
        ):
            knopf = QPushButton(beschriftung)
            knopf.clicked.connect(methode)
            knopfleiste.addWidget(knopf)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        regeln = self._regeln.regeln_laden(self._verbindung)
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(regeln))
        for zeile, regel in enumerate(regeln):
            name_item = QTableWidgetItem(regel["muster"])
            name_item.setData(Qt.UserRole, regel["id"])
            self._tabelle.setItem(zeile, 0, name_item)
            self._tabelle.setItem(
                zeile, 1, QTableWidgetItem(regel["objekt_name"] or "—")
            )
            self._tabelle.setItem(
                zeile, 2, QTableWidgetItem(regel["kategorie_name"] or "—")
            )
            self._tabelle.setItem(
                zeile, 3, QTableWidgetItem(regel["mieter_name"] or "—")
            )
            self._tabelle.setItem(
                zeile, 4, QTableWidgetItem("aktiv" if regel["aktiv"] else "inaktiv")
            )
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehlt(self) -> tuple[int, bool] | None:
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        return (
            self._tabelle.item(zeile, 0).data(Qt.UserRole),
            self._tabelle.item(zeile, 4).text() == "aktiv",
        )

    def _neu(self) -> None:
        if RegelDialog(self._verbindung, parent=self).exec() == QDialog.Accepted:
            self.aktualisieren()

    def _bearbeiten(self) -> None:
        auswahl = self._ausgewaehlt()
        if auswahl is None:
            QMessageBox.information(self, "Keine Regel gewählt",
                                    "Bitte zuerst eine Regel auswählen.")
            return
        if RegelDialog(self._verbindung, regel_id=auswahl[0],
                       parent=self).exec() == QDialog.Accepted:
            self.aktualisieren()

    def _status_aendern(self) -> None:
        auswahl = self._ausgewaehlt()
        if auswahl is None:
            return
        try:
            self._regeln.regel_aktiv_setzen(
                self._verbindung, auswahl[0], not auswahl[1]
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _loeschen(self) -> None:
        auswahl = self._ausgewaehlt()
        if auswahl is None:
            return
        antwort = QMessageBox.question(
            self, "Regel löschen", "Diese Regel wirklich löschen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            self._regeln.regel_loeschen(self._verbindung, auswahl[0])
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()
