"""Export-Bereich: Excel-Jahresübersicht erstellen."""

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
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen
from src.logic.export import jahres_export


class ExportSeite(QWidget):
    """Erstellt die Excel-Jahresübersicht für ein gewähltes Jahr."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Erstellt eine Excel-Datei mit der Jahresübersicht je Haus "
            "(Einnahmen, Ausgaben, Saldo und Mietzahlungen)."
        ))

        auswahlzeile = QHBoxLayout()
        auswahlzeile.addWidget(QLabel("Jahr:"))
        self._jahr = QComboBox()
        auswahlzeile.addWidget(self._jahr)
        knopf = QPushButton("Excel-Export erstellen")
        knopf.clicked.connect(self._exportieren)
        auswahlzeile.addWidget(knopf)
        auswahlzeile.addStretch()
        layout.addLayout(auswahlzeile)
        layout.addStretch()

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Baut die Jahresauswahl neu auf."""
        bisher = self._jahr.currentData()
        self._jahr.clear()
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._jahr.addItem(str(jahr), jahr)
        index = self._jahr.findData(bisher)
        self._jahr.setCurrentIndex(max(index, 0))

    def _exportieren(self) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            return
        try:
            pfad = jahres_export(self._verbindung, jahr)
        except (OSError, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return

        antwort = QMessageBox.question(
            self, "Export erstellt",
            f"Die Jahresübersicht wurde gespeichert unter:\n{pfad}\n\n"
            "Soll die Datei jetzt geöffnet werden?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort == QMessageBox.Yes:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(pfad)))
