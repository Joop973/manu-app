"""Buchungserfassung: Tabelle mit Filter, Anlegen, Bearbeiten, Löschen.

Buchungen können manuell erfasst werden; optional lässt sich ein Beleg
anhängen, der ins Archiv ``belege/<jahr>/`` kopiert wird.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal
from pathlib import Path

from PySide6.QtCore import QDate, Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen, stammdaten
from src.logic.belege import beleg_absolut, beleg_archivieren
from src.ui.tabelle import SortierItem, tabelle_vorbereiten
from src.utils.eingaben import (
    MONATSNAMEN,
    ValidierungsFehler,
    betrag_formatieren,
    betrag_parsen,
    datum_anzeigen,
)


class BuchungDialog(QDialog):
    """Formular zum Anlegen oder Bearbeiten einer Buchung."""

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        buchung_id: int | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._buchung_id = buchung_id
        self._beleg_bestehend: str | None = None  # relativer Pfad aus der DB
        self._beleg_neu: str | None = None        # neu gewählte Quelldatei
        self.setModal(True)
        self.setWindowTitle("Buchung bearbeiten" if buchung_id else "Neue Buchung")

        layout = QVBoxLayout(self)
        formular = QFormLayout()

        self._feld_datum = QDateEdit()
        self._feld_datum.setCalendarPopup(True)
        self._feld_datum.setDisplayFormat("dd.MM.yyyy")
        self._feld_datum.setDate(QDate.currentDate())
        formular.addRow("Datum:", self._feld_datum)

        self._feld_betrag = QLineEdit("0,00")
        formular.addRow("Betrag (€):", self._feld_betrag)

        self._feld_haus = QComboBox()
        for haus in stammdaten.objekte_laden(verbindung):
            text = haus["name"]
            if not haus["aktiv"]:
                text += "  (inaktiv)"
            self._feld_haus.addItem(text, haus["id"])
        self._feld_haus.currentIndexChanged.connect(self._mieter_combo_fuellen)
        formular.addRow("Haus:", self._feld_haus)

        self._feld_kategorie = QComboBox()
        for typ, bezeichnung in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
            for kategorie in stammdaten.kategorien_laden(verbindung, typ):
                text = f"{kategorie['name']} ({bezeichnung})"
                if not kategorie["aktiv"]:
                    text += " – inaktiv"
                self._feld_kategorie.addItem(text, kategorie["id"])
        formular.addRow("Kategorie:", self._feld_kategorie)

        # Mieter-Bezug (optional). Steuert auch die Anzeige
        # „Mieteinnahme von <Name>" in der Buchungsliste.
        self._feld_mieter = QComboBox()
        self._feld_mieter.setProperty("haus_combo", self._feld_haus)
        self._mieter_combo_fuellen()
        from src.ui.import_seite import _mieter_combo_aktivieren
        _mieter_combo_aktivieren(
            self._feld_mieter, self._verbindung, self
        )
        formular.addRow("Mieter (optional):", self._feld_mieter)

        self._feld_beschreibung = QLineEdit()
        self._feld_beschreibung.setPlaceholderText(
            "frei eintragen — z. B. Mieteinnahme von …, oder etwas Neues"
        )
        formular.addRow("Beschreibung:", self._feld_beschreibung)

        self._beleg_label = QLabel("kein Beleg")
        knopf_beleg = QPushButton("Wählen …")
        knopf_beleg.clicked.connect(self._beleg_waehlen)
        knopf_beleg_weg = QPushButton("Entfernen")
        knopf_beleg_weg.clicked.connect(self._beleg_entfernen)
        beleg_zeile = QHBoxLayout()
        beleg_zeile.addWidget(self._beleg_label, stretch=1)
        beleg_zeile.addWidget(knopf_beleg)
        beleg_zeile.addWidget(knopf_beleg_weg)
        formular.addRow("Beleg:", beleg_zeile)

        layout.addLayout(formular)

        if buchung_id is not None:
            self._daten_laden()

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _mieter_combo_fuellen(self) -> None:
        """Befüllt die Mieter-Auswahl passend zum gewählten Haus.

        Enthält am Ende einen Sondereintrag „+ Neuen Mieter anlegen …",
        sodass aus der Buchungs-Eingabe heraus direkt ein neuer Mieter
        erfasst werden kann — ohne Umweg über die Stammdaten.
        """
        from src.ui.import_seite import _mieter_combo_fuellen
        _mieter_combo_fuellen(
            self._feld_mieter, self._verbindung,
            self._feld_haus.currentData(),
        )

    def _daten_laden(self) -> None:
        """Füllt das Formular mit den Werten einer bestehenden Buchung."""
        zeile = self._verbindung.execute(
            "SELECT datum, betrag, objekt_id, kategorie_id, mieter_id, "
            "beschreibung, beleg_pfad FROM buchungen WHERE id = ?",
            (self._buchung_id,),
        ).fetchone()
        if zeile is None:
            return
        if zeile["datum"]:
            self._feld_datum.setDate(
                QDate.fromString(zeile["datum"], "yyyy-MM-dd")
            )
        self._feld_betrag.setText(betrag_formatieren(zeile["betrag"]))
        index_haus = self._feld_haus.findData(zeile["objekt_id"])
        if index_haus >= 0:
            self._feld_haus.setCurrentIndex(index_haus)
        index_kat = self._feld_kategorie.findData(zeile["kategorie_id"])
        if index_kat >= 0:
            self._feld_kategorie.setCurrentIndex(index_kat)
        # Haus-Wechsel hat das Mieter-Combo aktualisiert — jetzt Auswahl setzen.
        self._mieter_combo_fuellen()
        index_mieter = self._feld_mieter.findData(zeile["mieter_id"])
        if index_mieter >= 0:
            self._feld_mieter.setCurrentIndex(index_mieter)
        self._feld_beschreibung.setText(zeile["beschreibung"] or "")
        self._beleg_bestehend = zeile["beleg_pfad"]
        self._beleg_label_aktualisieren()

    def _beleg_waehlen(self) -> None:
        pfad, _ = QFileDialog.getOpenFileName(self, "Beleg auswählen")
        if pfad:
            self._beleg_neu = pfad
            self._beleg_label_aktualisieren()

    def _beleg_entfernen(self) -> None:
        self._beleg_neu = None
        self._beleg_bestehend = None
        self._beleg_label_aktualisieren()

    def _beleg_label_aktualisieren(self) -> None:
        if self._beleg_neu:
            self._beleg_label.setText(Path(self._beleg_neu).name + "  (neu)")
        elif self._beleg_bestehend:
            self._beleg_label.setText(Path(self._beleg_bestehend).name)
        else:
            self._beleg_label.setText("kein Beleg")

    def _speichern(self) -> None:
        """Validiert die Eingaben und schreibt die Buchung in die Datenbank."""
        try:
            betrag = betrag_parsen(self._feld_betrag.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return

        objekt_id = self._feld_haus.currentData()
        kategorie_id = self._feld_kategorie.currentData()
        if objekt_id is None or kategorie_id is None:
            QMessageBox.warning(
                self, "Auswahl fehlt",
                "Bitte Haus und Kategorie auswählen. Falls keine "
                "vorhanden sind, zuerst unter „Stammdaten“ anlegen."
            )
            return

        datum = self._feld_datum.date().toString("yyyy-MM-dd")
        jahr = self._feld_datum.date().year()

        beleg_pfad = self._beleg_bestehend
        if self._beleg_neu:
            try:
                beleg_pfad = beleg_archivieren(self._beleg_neu, jahr)
            except (OSError, FileNotFoundError) as fehler:
                QMessageBox.critical(
                    self, "Beleg konnte nicht archiviert werden", str(fehler)
                )
                return

        mieter_id = self._feld_mieter.currentData()
        try:
            if self._buchung_id is None:
                buchungen.buchung_anlegen(
                    self._verbindung, datum, betrag, objekt_id, kategorie_id,
                    self._feld_beschreibung.text().strip(), beleg_pfad,
                    "manuell", mieter_id=mieter_id,
                )
            else:
                buchungen.buchung_aktualisieren(
                    self._verbindung, self._buchung_id, datum, betrag,
                    objekt_id, kategorie_id,
                    self._feld_beschreibung.text().strip(), beleg_pfad,
                    mieter_id=mieter_id,
                )
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return

        self.accept()


class BuchungenSeite(QWidget):
    """Buchungsübersicht mit Filtern und Bearbeitungsfunktionen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        # Suchzeile
        suchzeile = QHBoxLayout()
        suchzeile.addWidget(QLabel("Suche:"))
        self._suche = QLineEdit()
        self._suche.setPlaceholderText(
            "Beschreibung, Haus, Kategorie oder Mietername — frei tippen"
        )
        self._suche.textChanged.connect(self._tabelle_laden)
        suchzeile.addWidget(self._suche, stretch=1)
        layout.addLayout(suchzeile)

        # Filterzeile
        filterzeile = QHBoxLayout()
        self._filter_haus = QComboBox()
        self._filter_kategorie = QComboBox()
        self._filter_monat = QComboBox()
        self._filter_jahr = QComboBox()
        self._filter_beleg = QComboBox()
        self._filter_beleg.addItem("Alle", None)
        self._filter_beleg.addItem("mit Beleg", True)
        self._filter_beleg.addItem("ohne Beleg", False)
        for beschriftung, combo in (
            ("Haus:", self._filter_haus),
            ("Kategorie:", self._filter_kategorie),
            ("Monat:", self._filter_monat),
            ("Jahr:", self._filter_jahr),
            ("Beleg:", self._filter_beleg),
        ):
            filterzeile.addWidget(QLabel(beschriftung))
            filterzeile.addWidget(combo)
            combo.currentIndexChanged.connect(self._tabelle_laden)
        filterzeile.addStretch()
        layout.addLayout(filterzeile)

        # Schnell-Eingabe (über der Tabelle, ohne Dialog)
        schnellzeile = QHBoxLayout()
        schnellzeile.addWidget(QLabel("Schnell-Eingabe:"))
        self._schnell_datum = QDateEdit()
        self._schnell_datum.setCalendarPopup(True)
        self._schnell_datum.setDisplayFormat("dd.MM.yyyy")
        self._schnell_datum.setDate(QDate.currentDate())
        schnellzeile.addWidget(self._schnell_datum)
        self._schnell_betrag = QLineEdit()
        self._schnell_betrag.setPlaceholderText("Betrag, z. B. 85,40")
        self._schnell_betrag.setFixedWidth(120)
        schnellzeile.addWidget(self._schnell_betrag)
        self._schnell_haus = QComboBox()
        for haus in stammdaten.objekte_laden(self._verbindung):
            self._schnell_haus.addItem(haus["name"], haus["id"])
        schnellzeile.addWidget(self._schnell_haus)
        self._schnell_kategorie = QComboBox()
        for typ, label in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
            for kat in stammdaten.kategorien_laden(self._verbindung, typ):
                self._schnell_kategorie.addItem(
                    f"{kat['name']} ({label})", kat["id"]
                )
        schnellzeile.addWidget(self._schnell_kategorie)
        self._schnell_text = QLineEdit()
        self._schnell_text.setPlaceholderText("Beschreibung")
        schnellzeile.addWidget(self._schnell_text, stretch=1)
        knopf_schnell = QPushButton("Hinzufügen")
        knopf_schnell.clicked.connect(self._schnell_anlegen)
        self._schnell_text.returnPressed.connect(self._schnell_anlegen)
        self._schnell_betrag.returnPressed.connect(self._schnell_anlegen)
        schnellzeile.addWidget(knopf_schnell)
        layout.addLayout(schnellzeile)

        # Tabelle
        self._tabelle = QTableWidget(0, 8)
        self._tabelle.setHorizontalHeaderLabels(
            ["Datum", "Betrag", "Haus", "Kategorie", "Mieter",
             "Beschreibung", "Beleg", "Quelle"]
        )
        tabelle_vorbereiten(self._tabelle)
        layout.addWidget(self._tabelle)

        # Knöpfe
        knopfleiste = QHBoxLayout()
        for beschriftung, methode in (
            ("Neue Buchung", self._neue_buchung),
            ("Bearbeiten", self._buchung_bearbeiten),
            ("Löschen", self._buchung_loeschen),
            ("Beleg öffnen", self._beleg_oeffnen),
        ):
            knopf = QPushButton(beschriftung)
            knopf.clicked.connect(methode)
            knopfleiste.addWidget(knopf)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        # Tastaturkürzel
        from PySide6.QtGui import QShortcut, QKeySequence
        QShortcut(QKeySequence("Ctrl+N"), self, self._neue_buchung)
        QShortcut(QKeySequence("Ctrl+F"), self, lambda: self._suche.setFocus())
        QShortcut(QKeySequence(Qt.Key_Delete), self, self._buchung_loeschen)
        QShortcut(QKeySequence("Ctrl+Return"), self, self._schnell_anlegen)
        self._tabelle.itemDoubleClicked.connect(
            lambda *_: self._buchung_bearbeiten()
        )

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt Filter-Auswahllisten und Tabelle neu."""
        self._filter_neu_aufbauen()
        self._tabelle_laden()

    def _schnell_anlegen(self) -> None:
        """Legt eine Buchung aus der Inline-Eingabezeile an."""
        if not self._schnell_betrag.text().strip():
            return
        try:
            betrag = betrag_parsen(self._schnell_betrag.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        objekt_id = self._schnell_haus.currentData()
        kategorie_id = self._schnell_kategorie.currentData()
        if objekt_id is None or kategorie_id is None:
            QMessageBox.warning(
                self, "Auswahl fehlt",
                "Haus und Kategorie sind nötig (unter Stammdaten anlegen)."
            )
            return
        datum = self._schnell_datum.date().toString("yyyy-MM-dd")
        try:
            buchungen.buchung_anlegen(
                self._verbindung, datum, betrag, objekt_id, kategorie_id,
                self._schnell_text.text().strip(), None, "manuell",
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.warning(self, "Fehler", str(fehler))
            return
        self._schnell_betrag.clear()
        self._schnell_text.clear()
        self._tabelle_laden()

    def _filter_neu_aufbauen(self) -> None:
        """Baut die Filter-Combos neu auf und behält die Auswahl bei."""
        for combo in (self._filter_haus, self._filter_kategorie,
                       self._filter_monat, self._filter_jahr):
            combo.blockSignals(True)

        haus_alt = self._filter_haus.currentData()
        self._filter_haus.clear()
        self._filter_haus.addItem("Alle Häuser", None)
        for haus in stammdaten.objekte_laden(self._verbindung):
            self._filter_haus.addItem(haus["name"], haus["id"])
        self._filter_haus.setCurrentIndex(
            max(self._filter_haus.findData(haus_alt), 0)
        )

        kat_alt = self._filter_kategorie.currentData()
        self._filter_kategorie.clear()
        self._filter_kategorie.addItem("Alle Kategorien", None)
        for typ in ("einnahme", "ausgabe"):
            for kategorie in stammdaten.kategorien_laden(self._verbindung, typ):
                self._filter_kategorie.addItem(kategorie["name"], kategorie["id"])
        self._filter_kategorie.setCurrentIndex(
            max(self._filter_kategorie.findData(kat_alt), 0)
        )

        monat_alt = self._filter_monat.currentData()
        self._filter_monat.clear()
        self._filter_monat.addItem("Alle Monate", None)
        for nummer, name in enumerate(MONATSNAMEN, start=1):
            self._filter_monat.addItem(name, nummer)
        self._filter_monat.setCurrentIndex(
            max(self._filter_monat.findData(monat_alt), 0)
        )

        jahr_alt = self._filter_jahr.currentData()
        self._filter_jahr.clear()
        self._filter_jahr.addItem("Alle Jahre", None)
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._filter_jahr.addItem(str(jahr), jahr)
        self._filter_jahr.setCurrentIndex(
            max(self._filter_jahr.findData(jahr_alt), 0)
        )

        for combo in (self._filter_haus, self._filter_kategorie,
                       self._filter_monat, self._filter_jahr):
            combo.blockSignals(False)

    def _tabelle_laden(self) -> None:
        """Füllt die Buchungstabelle nach den aktuellen Filtern."""
        zeilen = buchungen.buchungen_laden(
            self._verbindung,
            objekt_id=self._filter_haus.currentData(),
            kategorie_id=self._filter_kategorie.currentData(),
            monat=self._filter_monat.currentData(),
            jahr=self._filter_jahr.currentData(),
            beleg=self._filter_beleg.currentData(),
            suchtext=self._suche.text() if self._suche.text() else None,
        )
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(zeilen))
        for index, zeile in enumerate(zeilen):
            datum_item = SortierItem(
                datum_anzeigen(zeile["datum"]), zeile["datum"] or ""
            )
            datum_item.setData(Qt.UserRole, zeile["id"])
            datum_item.setData(Qt.UserRole + 1, zeile["beleg_pfad"])

            betrag = Decimal(zeile["betrag"])
            if zeile["kategorie_typ"] == "ausgabe":
                betrag = -betrag
            betrag_item = SortierItem(
                f"{betrag_formatieren(betrag)} €", betrag
            )

            beleg = zeile["beleg_pfad"]
            beleg_text = Path(beleg).name if beleg else "—"
            quelle = zeile["quelle"] or "manuell"
            quelle_text = "Mietzahlung" if quelle.startswith("mietzahlung") \
                else quelle

            werte = [
                datum_item,
                betrag_item,
                QTableWidgetItem(zeile["objekt_name"] or "—"),
                QTableWidgetItem(zeile["kategorie_name"] or "—"),
                QTableWidgetItem(zeile["mieter_name"] or "—"),
                QTableWidgetItem(zeile["beschreibung"] or ""),
                QTableWidgetItem(beleg_text),
                QTableWidgetItem(quelle_text),
            ]
            for spalte, item in enumerate(werte):
                self._tabelle.setItem(index, spalte, item)
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehlte_buchung(self) -> int | None:
        """Liefert die ID der markierten Buchung oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        return self._tabelle.item(zeile, 0).data(Qt.UserRole)

    def _neue_buchung(self) -> None:
        dialog = BuchungDialog(self._verbindung, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self.aktualisieren()

    def _buchung_bearbeiten(self) -> None:
        buchung_id = self._ausgewaehlte_buchung()
        if buchung_id is None:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        dialog = BuchungDialog(self._verbindung, buchung_id, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self.aktualisieren()

    def _buchung_loeschen(self) -> None:
        buchung_id = self._ausgewaehlte_buchung()
        if buchung_id is None:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        antwort = QMessageBox.question(
            self, "Buchung löschen",
            "Die markierte Buchung wirklich löschen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            buchungen.buchung_loeschen(self._verbindung, buchung_id)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _beleg_oeffnen(self) -> None:
        """Öffnet den Beleg der markierten Buchung im Standardprogramm."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        beleg = self._tabelle.item(zeile, 0).data(Qt.UserRole + 1)
        if not beleg:
            QMessageBox.information(
                self, "Kein Beleg",
                "Zu dieser Buchung ist kein Beleg hinterlegt."
            )
            return
        pfad = beleg_absolut(beleg)
        if not pfad.is_file():
            QMessageBox.warning(
                self, "Beleg nicht gefunden",
                f"Die Belegdatei wurde nicht gefunden:\n{pfad}"
            )
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(pfad)))
