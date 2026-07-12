"""Hauptfenster der Anwendung.

Die Navigationsleiste führt zu den sieben Bereichen. Der Bereich
„Stammdaten" ist ab Phase 2 voll funktionsfähig; die übrigen Bereiche
zeigen weiterhin Platzhalterseiten, bis sie in späteren Phasen folgen.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import QRectF, Qt, QTimer
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QMainWindow,
    QMessageBox,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from src.logic.backup import datensicherung_durchfuehren
from src.utils import paths
from src.ui.buchungen_seite import BuchungenSeite
from src.ui.dashboard_seite import DashboardSeite
from src.ui.einstellungen_seite import EinstellungenSeite
from src.ui.export_seite import ExportSeite
from src.ui.import_seite import ImportSeite
from src.ui.mieter_seite import MieterZahlungenSeite
from src.ui.nebenkosten_seite import NebenkostenSeite
from src.ui.stammdaten_seite import StammdatenSeite

# Reihenfolge der Bereiche in der Navigationsleiste.
NAVIGATIONSBEREICHE: list[str] = [
    "Dashboard",
    "Buchungen",
    "Mieter",
    "Import",
    "Stammdaten",
    "Export",
    "Nebenkosten",
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
            "Nebenkosten": lambda: NebenkostenSeite(self._verbindung),
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

        # Eingangs-Ordner kurz nach dem Start prüfen (Auto-Import).
        QTimer.singleShot(600, self._eingang_pruefen)

    def _eingang_pruefen(self) -> None:
        """Prüft den Eingangs-Ordner auf neue Kontoauszüge.

        Bereits importierte Auszüge (bekannte Kennung) werden still in
        den Unterordner ``verarbeitet`` verschoben; neue werden nach
        Rückfrage über den normalen Import-Weg verarbeitet und danach
        ebenfalls verschoben.
        """
        from src.db import auszuege
        from src.logic.pdf_import import auszug_kennung, rohtext_lesen

        ordner = paths.eingang_verzeichnis()
        if not ordner.is_dir():
            return
        neue: list[str] = []
        for pdf in sorted(ordner.glob("*.pdf")):
            try:
                kennung = auszug_kennung(rohtext_lesen(pdf))
            except Exception:  # noqa: BLE001 - defekte Datei liegen lassen
                continue
            if kennung and auszuege.ist_importiert(self._verbindung, kennung):
                self._eingang_ablegen(pdf)
                continue
            neue.append(str(pdf))
        if not neue:
            return
        antwort = QMessageBox.question(
            self, "Neue Kontoauszüge",
            f"Im Eingangs-Ordner liegen {len(neue)} neue "
            f"Kontoauszüge.\n\nJetzt importieren?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort != QMessageBox.Yes:
            return
        import_index = NAVIGATIONSBEREICHE.index("Import")
        import_seite = self._inhalt.widget(import_index)
        import_seite._mehrere_kontoauszuege_oeffnen(neue)
        # Erfolgreich verbuchte Auszüge (Kennung nun bekannt) ablegen.
        from pathlib import Path
        from src.db import auszuege as auszuege_db
        for pfad in neue:
            pdf = Path(pfad)
            try:
                kennung = auszug_kennung(rohtext_lesen(pdf))
            except Exception:  # noqa: BLE001
                continue
            if kennung and auszuege_db.ist_importiert(
                self._verbindung, kennung
            ):
                self._eingang_ablegen(pdf)

    @staticmethod
    def _eingang_ablegen(pdf) -> None:
        """Verschiebt eine verarbeitete Datei nach eingang/verarbeitet."""
        ziel_ordner = paths.eingang_verarbeitet_verzeichnis()
        ziel_ordner.mkdir(parents=True, exist_ok=True)
        ziel = ziel_ordner / pdf.name
        zaehler = 1
        while ziel.exists():
            ziel = ziel_ordner / f"{pdf.stem}_{zaehler}{pdf.suffix}"
            zaehler += 1
        try:
            pdf.rename(ziel)
        except OSError:
            pass

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
