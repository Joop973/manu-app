"""Mieter-Bereich: Monats-Checkliste der eingegangenen Mietzahlungen.

Ein gesetztes Häkchen erfasst die Miete des Monats und erzeugt die
zugehörigen Einnahme-Buchungen; ein entferntes Häkchen nimmt beides
wieder zurück.
"""

from __future__ import annotations

import sqlite3
from datetime import date

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QHeaderView,
    QLabel,
    QMessageBox,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QHBoxLayout,
    QVBoxLayout,
    QWidget,
)

from src.db import mietzahlungen, stammdaten
from src.utils.eingaben import MONATSNAMEN_KURZ, ValidierungsFehler

# Hintergrundfarbe für Monate außerhalb des Mietzeitraums.
_FARBE_INAKTIV = QColor("#e6e6e6")


def _jahr_monat(iso_datum: str | None) -> tuple[int, int] | None:
    """Wandelt ein ISO-Datum in ein (Jahr, Monat)-Tupel um."""
    if not iso_datum:
        return None
    try:
        jahr, monat, _ = iso_datum.split("-")
        return int(jahr), int(monat)
    except (ValueError, AttributeError):
        return None


def _monat_im_zeitraum(
    jahr_monat: tuple[int, int],
    von: tuple[int, int] | None,
    bis: tuple[int, int] | None,
) -> bool:
    """Prüft, ob ein Monat im Mietzeitraum (von … bis) liegt."""
    if von is not None and jahr_monat < von:
        return False
    if bis is not None and jahr_monat > bis:
        return False
    return True


class MieterZahlungenSeite(QWidget):
    """Checkliste „Miete eingegangen" je Mieter und Monat."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._laedt = False           # unterdrückt Signale beim Befüllen
        self._mieter_ids: list[int] = []  # Tabellenzeile -> Mieter-ID

        layout = QVBoxLayout(self)

        steuerzeile = QHBoxLayout()
        steuerzeile.addWidget(QLabel("Haus:"))
        self._haus = QComboBox()
        self._haus.currentIndexChanged.connect(self._tabelle_laden)
        steuerzeile.addWidget(self._haus)
        steuerzeile.addWidget(QLabel("Jahr:"))
        self._jahr = QSpinBox()
        self._jahr.setRange(2000, 2100)
        self._jahr.setValue(date.today().year)
        self._jahr.valueChanged.connect(self._tabelle_laden)
        steuerzeile.addWidget(self._jahr)
        steuerzeile.addStretch()
        layout.addLayout(steuerzeile)

        hinweis = QLabel(
            "Häkchen setzen = Miete eingegangen. Dabei werden automatisch "
            "Einnahme-Buchungen (Kaltmiete, Nebenkosten, Rücklage) erzeugt."
        )
        hinweis.setWordWrap(True)
        layout.addWidget(hinweis)

        self._tabelle = QTableWidget(0, 12)
        self._tabelle.setHorizontalHeaderLabels(MONATSNAMEN_KURZ)
        self._tabelle.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._tabelle.horizontalHeader().setSectionResizeMode(
            QHeaderView.Stretch
        )
        self._tabelle.itemChanged.connect(self._zahlung_geaendert)
        layout.addWidget(self._tabelle)

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt die Hausauswahl neu und behält die aktuelle Auswahl bei."""
        bisher = self._haus.currentData()
        self._haus.blockSignals(True)
        self._haus.clear()
        for haus in stammdaten.objekte_laden(self._verbindung):
            text = haus["name"]
            if not haus["aktiv"]:
                text += "  (inaktiv)"
            self._haus.addItem(text, haus["id"])
        self._haus.setCurrentIndex(max(self._haus.findData(bisher), 0))
        self._haus.blockSignals(False)
        self._tabelle_laden()

    def _tabelle_laden(self) -> None:
        """Baut die Checkliste für das gewählte Haus und Jahr auf."""
        objekt_id = self._haus.currentData()
        jahr = self._jahr.value()

        self._laedt = True
        self._mieter_ids = []
        self._tabelle.setRowCount(0)

        if objekt_id is not None:
            mieter = stammdaten.mieter_laden(self._verbindung, objekt_id)
            self._tabelle.setRowCount(len(mieter))
            namen = []
            for zeile, person in enumerate(mieter):
                self._mieter_ids.append(person["id"])
                namen.append(person["name"])
                bezahlt = mietzahlungen.bezahlte_monate(
                    self._verbindung, person["id"], jahr
                )
                von = _jahr_monat(person["aktiv_von"])
                bis = _jahr_monat(person["aktiv_bis"])
                for monat in range(1, 13):
                    item = QTableWidgetItem()
                    im_zeitraum = _monat_im_zeitraum((jahr, monat), von, bis)
                    if im_zeitraum:
                        item.setFlags(
                            Qt.ItemIsUserCheckable | Qt.ItemIsEnabled
                            | Qt.ItemIsSelectable
                        )
                    else:
                        # Monat außerhalb des Mietzeitraums: nicht änderbar.
                        item.setFlags(Qt.ItemIsSelectable)
                        item.setBackground(_FARBE_INAKTIV)
                    item.setCheckState(
                        Qt.Checked if monat in bezahlt else Qt.Unchecked
                    )
                    self._tabelle.setItem(zeile, monat - 1, item)
            self._tabelle.setVerticalHeaderLabels(namen)

        self._tabelle.verticalHeader().setVisible(True)
        self._laedt = False

    def _zahlung_geaendert(self, item: QTableWidgetItem) -> None:
        """Erfasst bzw. entfernt eine Mietzahlung bei Häkchen-Änderung."""
        if self._laedt:
            return
        zeile = item.row()
        if zeile >= len(self._mieter_ids):
            return
        mieter_id = self._mieter_ids[zeile]
        monat = item.column() + 1
        jahr = self._jahr.value()
        gesetzt = item.checkState() == Qt.Checked

        try:
            if gesetzt:
                mietzahlungen.mietzahlung_erfassen(
                    self._verbindung, mieter_id, monat, jahr
                )
            else:
                mietzahlungen.mietzahlung_entfernen(
                    self._verbindung, mieter_id, monat, jahr
                )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Fehler", str(fehler))
            # Häkchen auf den vorherigen Stand zurücksetzen
            self._laedt = True
            item.setCheckState(Qt.Unchecked if gesetzt else Qt.Checked)
            self._laedt = False
