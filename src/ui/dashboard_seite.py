"""Dashboard: Jahresübersicht je Haus mit Einnahmen, Ausgaben und Saldo.

Für das gewählte Jahr zeigt jede Haus-Karte die Jahressummen sowie den
Saldo des gewählten Monats. Eine Gesamtkarte fasst alle Häuser zusammen.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen, stammdaten
from src.utils.eingaben import MONATSNAMEN, betrag_formatieren

# Anzahl der Karten je Zeile.
_SPALTEN = 2
# Farben für positiven bzw. negativen Saldo.
_FARBE_POSITIV = "#1f7a4d"
_FARBE_NEGATIV = "#b3261e"


class DashboardSeite(QWidget):
    """Zeigt die finanzielle Jahresübersicht aller Häuser."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        steuerzeile = QHBoxLayout()
        steuerzeile.addWidget(QLabel("Jahr:"))
        self._jahr = QComboBox()
        self._jahr.currentIndexChanged.connect(self._anzeigen)
        steuerzeile.addWidget(self._jahr)
        steuerzeile.addWidget(QLabel("Monat:"))
        self._monat = QComboBox()
        for nummer, name in enumerate(MONATSNAMEN, start=1):
            self._monat.addItem(name, nummer)
        self._monat.setCurrentIndex(date.today().month - 1)
        self._monat.currentIndexChanged.connect(self._anzeigen)
        steuerzeile.addWidget(self._monat)
        steuerzeile.addStretch()
        layout.addLayout(steuerzeile)

        self._bereich = QScrollArea()
        self._bereich.setWidgetResizable(True)
        self._karten = QWidget()
        self._raster = QGridLayout(self._karten)
        self._bereich.setWidget(self._karten)
        layout.addWidget(self._bereich)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Baut die Jahres-Auswahl neu auf und zeigt die Karten an."""
        bisher = self._jahr.currentData()
        self._jahr.blockSignals(True)
        self._jahr.clear()
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._jahr.addItem(str(jahr), jahr)
        self._jahr.setCurrentIndex(max(self._jahr.findData(bisher), 0))
        self._jahr.blockSignals(False)
        self._anzeigen()

    def _raster_leeren(self) -> None:
        """Entfernt alle bestehenden Karten aus dem Raster."""
        while self._raster.count():
            element = self._raster.takeAt(0)
            widget = element.widget()
            if widget is not None:
                widget.deleteLater()

    def _anzeigen(self) -> None:
        """Berechnet die Summen und baut die Karten neu auf."""
        self._raster_leeren()
        jahr = self._jahr.currentData()
        monat = self._monat.currentData()
        if jahr is None:
            return

        auswertung = buchungen.jahres_auswertung(self._verbindung, jahr)
        haeuser = stammdaten.objekte_laden(self._verbindung, nur_aktive=True)

        gesamt_saldo = Decimal("0")
        for index, haus in enumerate(haeuser):
            daten = auswertung.get(haus["id"], {})
            einnahmen = daten.get("einnahmen", Decimal("0"))
            ausgaben = daten.get("ausgaben", Decimal("0"))
            saldo = einnahmen - ausgaben
            gesamt_saldo += saldo

            monat_einnahmen = daten.get("monat_einnahmen", {})
            monat_ausgaben = daten.get("monat_ausgaben", {})
            monats_saldo = (
                monat_einnahmen.get(monat, Decimal("0"))
                - monat_ausgaben.get(monat, Decimal("0"))
            )

            karte = self._haus_karte(
                haus["name"], einnahmen, ausgaben, saldo,
                monats_saldo, MONATSNAMEN[monat - 1],
                daten.get("anzahl", 0),
            )
            self._raster.addWidget(
                karte, index // _SPALTEN, index % _SPALTEN
            )

        naechste_zeile = (len(haeuser) + _SPALTEN - 1) // _SPALTEN
        self._raster.addWidget(
            self._gesamt_karte(gesamt_saldo), naechste_zeile, 0, 1, _SPALTEN
        )
        self._raster.addWidget(
            self._import_uebersicht(jahr),
            naechste_zeile + 1, 0, 1, _SPALTEN,
        )
        self._raster.setRowStretch(naechste_zeile + 2, 1)

    def _import_uebersicht(self, jahr: int) -> QGroupBox:
        """Zeigt je Monat, wie viele Auszugs-Buchungen importiert sind."""
        box = QGroupBox(f"Importierte Auszüge {jahr}")
        inhalt = QHBoxLayout(box)
        uebersicht = buchungen.import_monate_uebersicht(self._verbindung, jahr)
        for nummer, name in enumerate(MONATSNAMEN, start=1):
            anzahl = uebersicht.get(nummer, 0)
            zelle = QLabel(f"{name[:3]}\n{('✓ ' + str(anzahl)) if anzahl else '—'}")
            zelle.setAlignment(Qt.AlignCenter)
            farbe = "#1f7a4d" if anzahl else "#999999"
            zelle.setStyleSheet(
                f"color: {farbe}; padding: 4px; font-weight: bold;"
            )
            inhalt.addWidget(zelle)
        return box

    def _haus_karte(
        self,
        name: str,
        einnahmen: Decimal,
        ausgaben: Decimal,
        saldo: Decimal,
        monats_saldo: Decimal,
        monatsname: str,
        anzahl: int,
    ) -> QGroupBox:
        """Erzeugt eine Karte für ein einzelnes Haus."""
        box = QGroupBox(name)
        inhalt = QVBoxLayout(box)
        inhalt.addWidget(self._wertzeile("Einnahmen (Jahr)", einnahmen))
        inhalt.addWidget(self._wertzeile("Ausgaben (Jahr)", ausgaben))
        inhalt.addWidget(
            self._wertzeile("Saldo (Jahr)", saldo, hervorheben=True)
        )
        inhalt.addWidget(
            self._wertzeile(f"Saldo ({monatsname})", monats_saldo,
                            hervorheben=True)
        )
        anzahl_label = QLabel(f"erfasste Buchungen: {anzahl}")
        anzahl_label.setStyleSheet("color: #666666;")
        inhalt.addWidget(anzahl_label)
        return box

    def _gesamt_karte(self, gesamt_saldo: Decimal) -> QGroupBox:
        """Erzeugt die Gesamtkarte über alle Häuser."""
        box = QGroupBox("Alle Häuser")
        inhalt = QVBoxLayout(box)
        inhalt.addWidget(
            self._wertzeile("Gesamtsaldo (Jahr)", gesamt_saldo,
                            hervorheben=True)
        )
        return box

    @staticmethod
    def _wertzeile(
        beschriftung: str, betrag: Decimal, hervorheben: bool = False
    ) -> QLabel:
        """Erzeugt eine beschriftete Wertzeile, Saldo farbig hervorgehoben."""
        label = QLabel(f"{beschriftung}:  {betrag_formatieren(betrag)} €")
        if hervorheben:
            farbe = _FARBE_POSITIV if betrag >= 0 else _FARBE_NEGATIV
            label.setStyleSheet(f"color: {farbe}; font-weight: bold;")
        return label
