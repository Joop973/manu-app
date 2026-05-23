"""Nebenkostenabrechnung: Berechnung anzeigen und exportieren.

Zeigt je Haus und Jahr die umlagefähigen Kosten und die Verteilung auf
die Mieter. Exportiert die Abrechnung als Excel-Datei (alle Häuser) und
als PDF je Mieter des gewählten Hauses.
"""

from __future__ import annotations

import sqlite3
from datetime import date

from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QComboBox,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen, stammdaten
from src.logic import nebenkosten
from src.ui.tabelle import tabelle_vorbereiten
from src.utils.eingaben import ValidierungsFehler, betrag_formatieren


class NebenkostenSeite(QWidget):
    """Bereich zur Nebenkostenabrechnung."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        # Auswahlzeile
        auswahl = QHBoxLayout()
        auswahl.addWidget(QLabel("Haus:"))
        self._haus = QComboBox()
        self._haus.currentIndexChanged.connect(self._berechnen)
        auswahl.addWidget(self._haus)
        auswahl.addWidget(QLabel("Jahr:"))
        self._jahr = QComboBox()
        self._jahr.currentIndexChanged.connect(self._berechnen)
        auswahl.addWidget(self._jahr)
        auswahl.addStretch()
        layout.addLayout(auswahl)

        self._info = QLabel()
        self._info.setWordWrap(True)
        layout.addWidget(self._info)

        # Kostenaufstellung
        layout.addWidget(QLabel("Umlagefähige Kosten des Hauses:"))
        self._kosten_tabelle = QTableWidget(0, 2)
        self._kosten_tabelle.setHorizontalHeaderLabels(["Kategorie", "Betrag"])
        tabelle_vorbereiten(self._kosten_tabelle, sortierbar=False)
        layout.addWidget(self._kosten_tabelle)

        # Verteilung auf die Mieter
        layout.addWidget(QLabel("Verteilung auf die Mieter:"))
        self._mieter_tabelle = QTableWidget(0, 5)
        self._mieter_tabelle.setHorizontalHeaderLabels(
            ["Mieter", "Anteil", "Kostenanteil", "Vorauszahlung",
             "Nachzahlung / Guthaben"]
        )
        tabelle_vorbereiten(self._mieter_tabelle, sortierbar=False)
        layout.addWidget(self._mieter_tabelle)

        # Export-Knöpfe
        knopfzeile = QHBoxLayout()
        knopf_excel = QPushButton("Excel-Export (alle Häuser)")
        knopf_excel.clicked.connect(self._excel_export)
        knopf_pdf = QPushButton("PDF-Abrechnungen erzeugen (dieses Haus)")
        knopf_pdf.clicked.connect(self._pdf_export)
        knopfzeile.addWidget(knopf_excel)
        knopfzeile.addWidget(knopf_pdf)
        knopfzeile.addStretch()
        layout.addLayout(knopfzeile)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Baut Haus- und Jahresauswahl neu auf und berechnet die Abrechnung."""
        haus_alt = self._haus.currentData()
        jahr_alt = self._jahr.currentData()

        self._haus.blockSignals(True)
        self._jahr.blockSignals(True)

        self._haus.clear()
        for haus in stammdaten.objekte_laden(self._verbindung):
            self._haus.addItem(haus["name"], haus["id"])
        self._haus.setCurrentIndex(max(self._haus.findData(haus_alt), 0))

        self._jahr.clear()
        jahre = set(buchungen.jahre_laden(self._verbindung))
        jahre.add(date.today().year)
        for jahr in sorted(jahre, reverse=True):
            self._jahr.addItem(str(jahr), jahr)
        self._jahr.setCurrentIndex(max(self._jahr.findData(jahr_alt), 0))

        self._haus.blockSignals(False)
        self._jahr.blockSignals(False)
        self._berechnen()

    def _berechnen(self) -> None:
        """Berechnet die Abrechnung für die aktuelle Auswahl und zeigt sie an."""
        objekt_id = self._haus.currentData()
        jahr = self._jahr.currentData()
        self._kosten_tabelle.setRowCount(0)
        self._mieter_tabelle.setRowCount(0)
        if objekt_id is None or jahr is None:
            self._info.setText("")
            return

        try:
            abrechnung = nebenkosten.abrechnung_erstellen(
                self._verbindung, objekt_id, jahr
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Fehler", str(fehler))
            return

        schluessel = stammdaten.UMLAGESCHLUESSEL.get(
            abrechnung["umlageschluessel"], abrechnung["umlageschluessel"]
        )
        self._info.setText(
            f"Umlageschlüssel: {schluessel}  ·  "
            f"Umlagefähige Kosten gesamt: "
            f"{betrag_formatieren(abrechnung['kosten_gesamt'])} €"
        )

        self._kosten_tabelle.setRowCount(len(abrechnung["kosten"]))
        for zeile, (name, betrag) in enumerate(abrechnung["kosten"]):
            self._kosten_tabelle.setItem(zeile, 0, QTableWidgetItem(name))
            self._kosten_tabelle.setItem(
                zeile, 1, QTableWidgetItem(f"{betrag_formatieren(betrag)} €")
            )

        self._mieter_tabelle.setRowCount(len(abrechnung["mieter"]))
        for zeile, eintrag in enumerate(abrechnung["mieter"]):
            differenz = eintrag["differenz"]
            if differenz >= 0:
                differenz_text = f"Guthaben {betrag_formatieren(differenz)} €"
            else:
                differenz_text = f"Nachzahlung {betrag_formatieren(-differenz)} €"
            werte = [
                eintrag["name"],
                f"{eintrag['anteil'] * 100:.1f} %",
                f"{betrag_formatieren(eintrag['kostenanteil'])} €",
                f"{betrag_formatieren(eintrag['vorauszahlung'])} €",
                differenz_text,
            ]
            for spalte, wert in enumerate(werte):
                self._mieter_tabelle.setItem(
                    zeile, spalte, QTableWidgetItem(wert)
                )

    def _excel_export(self) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            return
        try:
            pfad = nebenkosten.abrechnung_excel(self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValidierungsFehler) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        self._fertig_melden("Excel-Abrechnung erstellt", str(pfad), pfad)

    def _pdf_export(self) -> None:
        objekt_id = self._haus.currentData()
        jahr = self._jahr.currentData()
        if objekt_id is None or jahr is None:
            return
        try:
            pfade = nebenkosten.abrechnung_pdfs(
                self._verbindung, objekt_id, jahr
            )
        except (OSError, sqlite3.Error, ValidierungsFehler) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        if not pfade:
            QMessageBox.information(
                self, "Keine Mieter",
                "Für dieses Haus und Jahr gibt es keine Mieter."
            )
            return
        self._fertig_melden(
            "PDF-Abrechnungen erstellt",
            f"{len(pfade)} PDF-Datei(en) wurden erstellt unter:\n"
            f"{pfade[0].parent}",
            pfade[0].parent,
        )

    def _fertig_melden(self, titel: str, text: str, oeffnen_pfad) -> None:
        """Meldet einen erfolgreichen Export und bietet das Öffnen an."""
        antwort = QMessageBox.question(
            self, titel, f"{text}\n\nJetzt öffnen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort == QMessageBox.Yes:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(oeffnen_pfad)))
