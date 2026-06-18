"""Export-Bereich: Jahresübersicht, Anlage V, Steuerberater-PDFs."""

from __future__ import annotations

import sqlite3
from pathlib import Path

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
from src.logic import anlage_v
from src.logic.export import jahres_export


class ExportSeite(QWidget):
    """Excel-Jahresübersicht, Anlage V und PDF-Steuerberichte je Jahr."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Für das gewählte Jahr stehen drei Exporte bereit: die laufende "
            "Jahresübersicht (Excel), eine fertige Anlage V (Excel) und ein "
            "PDF-Steuerbericht je Haus für den Steuerberater."
        ))

        auswahlzeile = QHBoxLayout()
        auswahlzeile.addWidget(QLabel("Jahr:"))
        self._jahr = QComboBox()
        auswahlzeile.addWidget(self._jahr)
        auswahlzeile.addStretch()
        layout.addLayout(auswahlzeile)

        knopfzeile = QHBoxLayout()
        knopf_jahres = QPushButton("Jahresübersicht (Excel)")
        knopf_jahres.clicked.connect(self._jahres_export)
        knopf_anlage = QPushButton("Anlage V (Excel)")
        knopf_anlage.clicked.connect(self._anlage_v_export)
        knopf_steuer = QPushButton("Steuerberater-PDFs (je Haus)")
        knopf_steuer.clicked.connect(self._steuerbericht_export)
        for k in (knopf_jahres, knopf_anlage, knopf_steuer):
            knopfzeile.addWidget(k)
        knopfzeile.addStretch()
        layout.addLayout(knopfzeile)
        layout.addStretch()

        self.aktualisieren()

    def aktualisieren(self) -> None:
        bisher = self._jahr.currentData()
        self._jahr.clear()
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._jahr.addItem(str(jahr), jahr)
        index = self._jahr.findData(bisher)
        self._jahr.setCurrentIndex(max(index, 0))

    def _jahres_export(self) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            return
        try:
            pfad = jahres_export(self._verbindung, jahr)
        except (OSError, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        self._fertig_melden("Jahresübersicht erstellt", str(pfad), pfad)

    def _anlage_v_export(self) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            return
        try:
            pfad = anlage_v.anlage_v_excel(self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValueError) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        self._fertig_melden("Anlage V erstellt", str(pfad), pfad)

    def _steuerbericht_export(self) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            return
        try:
            pfade = anlage_v.steuerbericht_pdfs(self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValueError) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        if not pfade:
            QMessageBox.information(self, "Keine Häuser",
                                    "Es sind keine Häuser angelegt.")
            return
        self._fertig_melden(
            "Steuerberichte erstellt",
            f"{len(pfade)} PDF-Datei(en) wurden erstellt unter:\n"
            f"{pfade[0].parent}",
            pfade[0].parent,
        )

    def _fertig_melden(self, titel: str, text: str, oeffnen_pfad: Path) -> None:
        antwort = QMessageBox.question(
            self, titel, f"{text}\n\nJetzt öffnen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort == QMessageBox.Yes:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(oeffnen_pfad)))
