"""Hauptfenster der Anwendung.

Die Navigationsleiste führt zu den sieben Bereichen. Der Bereich
„Stammdaten" ist ab Phase 2 voll funktionsfähig; die übrigen Bereiche
zeigen weiterhin Platzhalterseiten, bis sie in späteren Phasen folgen.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import QRectF, Qt
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QMainWindow,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from src.logic.backup import datensicherung_durchfuehren
from src.ui.buchungen_seite import BuchungenSeite
from src.ui.dashboard_seite import DashboardSeite
from src.ui.einstellungen_seite import EinstellungenSeite
from src.ui.export_seite import ExportSeite
from src.ui.import_seite import ImportSeite
from src.ui.mieter_seite import MieterZahlungenSeite
from src.ui.stammdaten_seite import StammdatenSeite

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


def manu_symbol() -> QIcon:
    """Erzeugt das App-Symbol (grünes Quadrat mit „M") ohne Bilddatei."""
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.transparent)
    maler = QPainter(pixmap)
    maler.setRenderHint(QPainter.Antialiasing)
    maler.setPen(Qt.NoPen)
    maler.setBrush(QColor("#1f7a4d"))
    maler.drawRoundedRect(QRectF(2, 2, 60, 60), 14, 14)
    maler.setPen(QColor("#ffffff"))
    schrift = QFont()
    schrift.setPointSize(34)
    schrift.setBold(True)
    maler.setFont(schrift)
    maler.drawText(pixmap.rect(), Qt.AlignCenter, "M")
    maler.end()
    return QIcon(pixmap)


class MainWindow(QMainWindow):
    """Rahmenfenster mit seitlicher Navigation und Inhaltsbereich."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setWindowTitle("Manu — Hausverwaltung & Controlling")
        self.setWindowIcon(manu_symbol())
        self.resize(1000, 680)
        self.setMinimumSize(820, 560)

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

        # Inhaltsbereich rechts — fertige Bereiche je Phase
        self._inhalt = QStackedWidget()
        seiten = {
            "Dashboard": lambda: DashboardSeite(self._verbindung),
            "Buchungen": lambda: BuchungenSeite(self._verbindung),
            "Mieter": lambda: MieterZahlungenSeite(self._verbindung),
            "Import": lambda: ImportSeite(self._verbindung),
            "Stammdaten": lambda: StammdatenSeite(self._verbindung),
            "Export": lambda: ExportSeite(self._verbindung),
            "Einstellungen": lambda: EinstellungenSeite(self._verbindung),
        }
        for bereich in NAVIGATIONSBEREICHE:
            if bereich in seiten:
                self._inhalt.addWidget(seiten[bereich]())
            else:
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
        """Schaltet den Inhaltsbereich um und lädt dessen Daten neu."""
        if not 0 <= zeile < self._inhalt.count():
            return
        self._inhalt.setCurrentIndex(zeile)
        seite = self._inhalt.widget(zeile)
        if hasattr(seite, "aktualisieren"):
            seite.aktualisieren()

    def closeEvent(self, ereignis) -> None:  # noqa: N802 - Qt-Vorgabe
        """Erstellt beim Schließen automatisch eine Datensicherung."""
        try:
            datensicherung_durchfuehren(self._verbindung)
        except Exception:  # noqa: BLE001 - Schließen darf nie scheitern
            pass
        super().closeEvent(ereignis)
