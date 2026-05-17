"""Hauptfenster der Anwendung.

In Phase 1 enthält das Fenster nur die Navigationsleiste und für jeden
Bereich eine Platzhalterseite. Die eigentlichen Inhalte (Dashboard,
Buchungen, Mieter, Import, Stammdaten, Export, Einstellungen) folgen in
den späteren Phasen.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QMainWindow,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

# Reihenfolge der Bereiche in der Navigationsleiste.
NAVIGATIONSBEREICHE: list[str] = [
    "Dashboard",
    "Buchungen",
    "Mieter",
    "Import",
    "Stammdaten",
    "Export",
    "Einstellungen",
]


class MainWindow(QMainWindow):
    """Rahmenfenster mit seitlicher Navigation und Inhaltsbereich."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setWindowTitle("Manu — Hausverwaltung & Controlling")
        self.resize(1000, 680)

        zentral = QWidget()
        layout = QHBoxLayout(zentral)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Navigationsleiste links
        self._navigation = QListWidget()
        self._navigation.setFixedWidth(190)
        self._navigation.addItems(NAVIGATIONSBEREICHE)
        self._navigation.currentRowChanged.connect(self._bereich_wechseln)
        layout.addWidget(self._navigation)

        # Inhaltsbereich rechts
        self._inhalt = QStackedWidget()
        for bereich in NAVIGATIONSBEREICHE:
            self._inhalt.addWidget(self._platzhalter_seite(bereich))
        layout.addWidget(self._inhalt, stretch=1)

        self.setCentralWidget(zentral)
        self._navigation.setCurrentRow(0)

    @staticmethod
    def _platzhalter_seite(bereich: str) -> QWidget:
        """Erzeugt eine schlichte Platzhalterseite für einen Bereich."""
        seite = QWidget()
        seiten_layout = QVBoxLayout(seite)
        seiten_layout.setAlignment(Qt.AlignCenter)

        titel = QLabel(bereich)
        titel.setAlignment(Qt.AlignCenter)
        titel_schrift = titel.font()
        titel_schrift.setPointSize(20)
        titel_schrift.setBold(True)
        titel.setFont(titel_schrift)

        hinweis = QLabel("Dieser Bereich wird in einer späteren Phase ergänzt.")
        hinweis.setAlignment(Qt.AlignCenter)

        seiten_layout.addWidget(titel)
        seiten_layout.addWidget(hinweis)
        return seite

    def _bereich_wechseln(self, zeile: int) -> None:
        """Schaltet den Inhaltsbereich passend zur Navigationsauswahl um."""
        if 0 <= zeile < self._inhalt.count():
            self._inhalt.setCurrentIndex(zeile)
