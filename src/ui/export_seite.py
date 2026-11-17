"""Export-Bereich: Prüfbericht, Anlage V, Steuerberater-Paket, DATEV.

Empfohlener Ablauf (wird auf der Seite erklärt):
1. Prüfbericht öffnen und alle Fehler beheben.
2. Steuerpaket für den Steuerberater erstellen (Ordner + ZIP mit
   Anlage V, Einzelnachweis, PDF-Berichten, DATEV-Datei und Belegen).
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal
from pathlib import Path

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen
from src.logic import datev, steuer, steuer_export
from src.logic.export import jahres_export
from src.utils.eingaben import ValidierungsFehler, betrag_formatieren
from src.utils.paths import exporte_verzeichnis


class ExportSeite(QWidget):
    """Steuer-Exporte je Jahr mit vorgeschaltetem Prüfbericht."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        einleitung = QLabel(
            "<b>So geht's:</b> 1. Prüfbericht öffnen und alle <i>Fehler</i> "
            "beheben. 2. „Steuerpaket für den Steuerberater“ erstellen – "
            "darin ist alles: Anlage V je Haus, Einzelnachweis mit "
            "Belegverweis, PDF-Berichte, Mieteinnahmen-Nachweis, "
            "DATEV-Buchungsstapel und alle Belege (als Ordner und ZIP)."
        )
        einleitung.setWordWrap(True)
        layout.addWidget(einleitung)

        auswahlzeile = QHBoxLayout()
        auswahlzeile.addWidget(QLabel("Steuerjahr:"))
        self._jahr = QComboBox()
        self._jahr.currentIndexChanged.connect(self._status_aktualisieren)
        auswahlzeile.addWidget(self._jahr)
        knopf_einst = QPushButton("Einstellungen (DATEV, Zeilennummern) …")
        knopf_einst.clicked.connect(self._einstellungen)
        auswahlzeile.addWidget(knopf_einst)
        auswahlzeile.addStretch()
        layout.addLayout(auswahlzeile)

        self._status = QLabel()
        self._status.setWordWrap(True)
        layout.addWidget(self._status)

        gruppe = QGroupBox("Steuer")
        raster = QGridLayout(gruppe)
        knoepfe = [
            ("1. Prüfbericht …", self._pruefbericht,
             "Findet Fehler, die das Ergebnis verfälschen (ungeklärte "
             "Kategorien, doppelte Mieten, Erstattungen, Jahreswechsel)."),
            ("2. Steuerpaket für den Steuerberater", self._steuerpaket,
             "Ordner + ZIP mit allen Unterlagen des Jahres."),
            ("Anlage V + Einzelnachweis (Excel)", self._anlage_v_export,
             "Arbeitsmappe mit Übersicht, Blatt je Haus, Einzelnachweis "
             "und Prüfhinweisen."),
            ("Steuerberater-PDFs (je Haus)", self._steuerbericht_export,
             "Ein PDF je Haus mit Positionen, AfA und Einzelnachweis."),
            ("DATEV-Buchungsstapel (CSV)", self._datev_export,
             "Datei im DATEV-Format zum Import beim Steuerberater."),
        ]
        for index, (text, methode, tipp) in enumerate(knoepfe):
            knopf = QPushButton(text)
            knopf.setToolTip(tipp)
            knopf.clicked.connect(methode)
            raster.addWidget(knopf, index // 2, index % 2)
        layout.addWidget(gruppe)

        gruppe2 = QGroupBox("Controlling")
        zeile2 = QHBoxLayout(gruppe2)
        knopf_jahres = QPushButton("Jahresübersicht (Excel)")
        knopf_jahres.clicked.connect(self._jahres_export)
        zeile2.addWidget(knopf_jahres)
        zeile2.addStretch()
        layout.addWidget(gruppe2)
        layout.addStretch()

        self.aktualisieren()

    # ------------------------------------------------------------------

    def aktualisieren(self) -> None:
        bisher = self._jahr.currentData()
        self._jahr.blockSignals(True)
        self._jahr.clear()
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._jahr.addItem(str(jahr), jahr)
        index = self._jahr.findData(bisher)
        if index < 0:
            from datetime import date
            index = max(self._jahr.findData(date.today().year), 0)
        self._jahr.setCurrentIndex(index)
        self._jahr.blockSignals(False)
        self._status_aktualisieren()

    def _status_aktualisieren(self, *_args) -> None:
        jahr = self._jahr.currentData()
        if jahr is None:
            self._status.setText("")
            return
        try:
            hinweise = steuer.pruefen(self._verbindung, jahr)
            einkuenfte = sum(
                (steuer.auswertung(self._verbindung, h["id"], jahr)["einkuenfte"]
                 for h in steuer.haeuser_mit_daten(self._verbindung, jahr)),
                start=Decimal("0"),
            )
        except (sqlite3.Error, ValueError) as fehler:
            self._status.setText(f"Prüfung nicht möglich: {fehler}")
            return
        fehler = sum(1 for h in hinweise if h["stufe"] == steuer.FEHLER)
        warnungen = sum(1 for h in hinweise if h["stufe"] == steuer.WARNUNG)
        farbe = "#b3261e" if fehler else ("#7a5b00" if warnungen else
                                          "#1f7a4d")
        self._status.setText(
            f"<span style='color:{farbe}'><b>{jahr}: {fehler} Fehler, "
            f"{warnungen} zu prüfen.</b></span> Einkünfte aus V+V (alle "
            f"Häuser, vorläufig): <b>{betrag_formatieren(einkuenfte)} €</b>"
        )

    def _jahr_wert(self) -> int | None:
        return self._jahr.currentData()

    def _fehler_bestaetigt(self, jahr: int) -> bool:
        """Warnt vor dem Export, wenn der Prüfbericht noch Fehler enthält."""
        fehler = [h for h in steuer.pruefen(self._verbindung, jahr)
                  if h["stufe"] == steuer.FEHLER]
        if not fehler:
            return True
        antwort = QMessageBox.question(
            self, "Prüfbericht enthält Fehler",
            f"Der Prüfbericht {jahr} meldet {len(fehler)} Fehler, z. B.:\n\n"
            f"• {fehler[0]['text'][:300]}\n\n"
            "Das Ergebnis ist so voraussichtlich falsch. Trotzdem "
            "exportieren?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        return antwort == QMessageBox.Yes

    # ------------------------------------------------------------------

    def _einstellungen(self) -> None:
        from src.ui.steuer_dialoge import ExportEinstellungenDialog
        ExportEinstellungenDialog(self._verbindung, self).exec()

    def _pruefbericht(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None:
            return
        from src.ui.steuer_dialoge import PruefberichtDialog
        PruefberichtDialog(self._verbindung, jahr, self).exec()
        self._status_aktualisieren()

    def _steuerpaket(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None or not self._fehler_bestaetigt(jahr):
            return
        QApplication.setOverrideCursor(Qt.WaitCursor)
        try:
            ergebnis = steuer_export.steuerpaket_erstellen(
                self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValueError) as fehler:
            QApplication.restoreOverrideCursor()
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        QApplication.restoreOverrideCursor()
        text = (f"Steuerpaket {jahr} erstellt:\n{ergebnis['ordner']}\n"
                f"ZIP zum Versenden: {ergebnis['zip'].name}\n\n"
                f"{len(ergebnis['dateien'])} Dokumente, "
                f"{ergebnis['belege']} Belege.")
        if ergebnis["meldungen"]:
            text += "\n\nHinweise:\n• " + "\n• ".join(ergebnis["meldungen"])
        self._fertig_melden("Steuerpaket erstellt", text, ergebnis["ordner"])

    def _anlage_v_export(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None or not self._fehler_bestaetigt(jahr):
            return
        try:
            pfad = steuer_export.anlage_v_excel(self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValueError) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        self._fertig_melden("Anlage V erstellt", str(pfad), pfad)

    def _steuerbericht_export(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None or not self._fehler_bestaetigt(jahr):
            return
        try:
            pfade = steuer_export.steuerbericht_pdfs(self._verbindung, jahr)
        except (OSError, sqlite3.Error, ValueError) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        if not pfade:
            QMessageBox.information(self, "Keine Häuser",
                                    "Für dieses Jahr gibt es keine Daten.")
            return
        self._fertig_melden(
            "Steuerberichte erstellt",
            f"{len(pfade)} PDF-Datei(en) wurden erstellt unter:\n"
            f"{pfade[0].parent}",
            pfade[0].parent,
        )

    def _datev_export(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None or not self._fehler_bestaetigt(jahr):
            return
        ziel = exporte_verzeichnis() / f"EXTF_Buchungsstapel_{jahr}.csv"
        try:
            pfad, hinweise = datev.buchungsstapel_schreiben(
                self._verbindung, jahr, ziel)
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "DATEV-Export", str(fehler))
            self._einstellungen()
            return
        except (OSError, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        text = str(pfad)
        if hinweise:
            text += "\n\nHinweise:\n• " + "\n• ".join(hinweise[:8])
        self._fertig_melden("DATEV-Buchungsstapel erstellt", text, pfad.parent)

    def _jahres_export(self) -> None:
        jahr = self._jahr_wert()
        if jahr is None:
            return
        try:
            pfad = jahres_export(self._verbindung, jahr)
        except (OSError, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Export fehlgeschlagen", str(fehler))
            return
        self._fertig_melden("Jahresübersicht erstellt", str(pfad), pfad)

    def _fertig_melden(self, titel: str, text: str, oeffnen_pfad: Path) -> None:
        antwort = QMessageBox.question(
            self, titel, f"{text}\n\nJetzt öffnen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort == QMessageBox.Yes:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(oeffnen_pfad)))
