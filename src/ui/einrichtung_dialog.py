"""Erst-Einrichtungs-Assistent für die automatische Buchungserfassung.

Wird nach der Anmeldung angezeigt, solange die Einrichtung noch nicht
abgeschlossen wurde. Führt in einem Fenster durch die drei Schritte,
die die Import-Automatik scharfschalten:

1. Erkennungstext je Haus (Straßenname, wie er im Kontoauszug steht)
2. Standard-Haus für nicht zuordenbare Buchungen
3. Vollautomatik ein/aus

Der Assistent lässt sich überspringen und erscheint dann beim nächsten
Start erneut — bis er einmal abgeschlossen oder dauerhaft abgewählt wird.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
)

from src.db import stammdaten
from src.db.einstellungen import (
    SCHLUESSEL_AUTO_IMPORT,
    SCHLUESSEL_STANDARD_HAUS,
    einstellung_lesen,
    einstellung_schreiben,
)

# Einstellungsschlüssel: "1" sobald der Assistent abgeschlossen bzw.
# dauerhaft abgewählt wurde.
SCHLUESSEL_EINRICHTUNG = "einrichtung_automatik"


def einrichtung_noetig(verbindung: sqlite3.Connection) -> bool:
    """Prüft, ob der Assistent beim Start gezeigt werden soll."""
    return einstellung_lesen(verbindung, SCHLUESSEL_EINRICHTUNG) != "1"


class EinrichtungsAssistent(QDialog):
    """Führt einmalig durch die Einrichtung der Import-Automatik."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setModal(True)
        self.setWindowTitle("Automatik einrichten")
        self.resize(620, 520)

        layout = QVBoxLayout(self)
        begruessung = QLabel(
            "<b>Automatische Buchungserfassung einrichten</b><br><br>"
            "Drei kurze Angaben, damit deine Kontoauszüge künftig "
            "weitgehend ohne Handarbeit verbucht werden. Du kannst alles "
            "später unter <i>Einstellungen</i> und <i>Stammdaten</i> ändern."
        )
        begruessung.setWordWrap(True)
        layout.addWidget(begruessung)

        # --- Schritt 1: Erkennungstexte je Haus ---
        gruppe_haeuser = QGroupBox(
            "1. Woran erkennt man deine Häuser im Verwendungszweck?"
        )
        haeuser_layout = QVBoxLayout(gruppe_haeuser)
        hinweis = QLabel(
            "Trage je Haus den Straßennamen ein, wie er im Kontoauszug "
            "auftaucht — gern mehrere Schreibweisen durch Leerzeichen "
            "getrennt (Auszüge lassen Umlaute oft weg, z. B. "
            "„Südstraße Sudstrase“). Leer lassen, wenn unklar."
        )
        hinweis.setWordWrap(True)
        haeuser_layout.addWidget(hinweis)

        self._erkennungsfelder: list[tuple[int, QLineEdit]] = []
        for haus in stammdaten.objekte_laden(verbindung, nur_aktive=True):
            zeile = QHBoxLayout()
            beschriftung = QLabel(haus["name"] + ":")
            beschriftung.setMinimumWidth(140)
            zeile.addWidget(beschriftung)
            feld = QLineEdit()
            try:
                if haus["erkennungstext"]:
                    feld.setText(haus["erkennungstext"])
            except (KeyError, IndexError):
                pass
            feld.setPlaceholderText("z. B. Straßenname aus dem Auszug")
            zeile.addWidget(feld)
            haeuser_layout.addLayout(zeile)
            self._erkennungsfelder.append((haus["id"], feld))
        layout.addWidget(gruppe_haeuser)

        # --- Schritt 2: Standard-Haus ---
        gruppe_standard = QGroupBox(
            "2. Welches Haus gilt, wenn nichts erkannt wird?"
        )
        standard_layout = QVBoxLayout(gruppe_standard)
        standard_layout.addWidget(QLabel(
            "Buchungen ohne erkennbares Haus bekommen automatisch dieses "
            "Standard-Haus (z. B. das Haus, zu dem dein Konto überwiegend "
            "gehört)."
        ))
        self._standard_haus = QComboBox()
        self._standard_haus.addItem("— keins (Zeile bleibt zur Kontrolle) —",
                                    None)
        for haus in stammdaten.objekte_laden(verbindung, nur_aktive=True):
            self._standard_haus.addItem(haus["name"], haus["id"])
        gespeichert = einstellung_lesen(verbindung, SCHLUESSEL_STANDARD_HAUS)
        if gespeichert:
            try:
                index = self._standard_haus.findData(int(gespeichert))
                if index >= 0:
                    self._standard_haus.setCurrentIndex(index)
            except (ValueError, TypeError):
                pass
        standard_layout.addWidget(self._standard_haus)
        layout.addWidget(gruppe_standard)

        # --- Schritt 3: Vollautomatik ---
        gruppe_auto = QGroupBox("3. Wie automatisch soll der Import laufen?")
        auto_layout = QVBoxLayout(gruppe_auto)
        self._auto_import = QCheckBox(
            "Sicher zugeordnete Buchungen sofort übernehmen — die Vorschau "
            "zeigt nur noch unklare Fälle (empfohlen)"
        )
        self._auto_import.setChecked(
            einstellung_lesen(verbindung, SCHLUESSEL_AUTO_IMPORT, "0") == "1"
        )
        auto_layout.addWidget(self._auto_import)
        layout.addWidget(gruppe_auto)

        layout.addStretch()

        # --- Knöpfe ---
        knopfzeile = QHBoxLayout()
        self._nicht_mehr = QCheckBox("Nicht mehr anzeigen")
        knopfzeile.addWidget(self._nicht_mehr)
        knopfzeile.addStretch()
        knopf_spaeter = QPushButton("Später")
        knopf_spaeter.clicked.connect(self._spaeter)
        knopfzeile.addWidget(knopf_spaeter)
        knopf_fertig = QPushButton("Fertig — Automatik aktivieren")
        knopf_fertig.setDefault(True)
        knopf_fertig.clicked.connect(self._abschliessen)
        knopfzeile.addWidget(knopf_fertig)
        layout.addLayout(knopfzeile)

    def _spaeter(self) -> None:
        """Schließt ohne Speichern; erscheint beim nächsten Start wieder."""
        if self._nicht_mehr.isChecked():
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_EINRICHTUNG, "1"
            )
        self.reject()

    def _abschliessen(self) -> None:
        """Speichert alle Angaben und markiert die Einrichtung als erledigt."""
        try:
            for objekt_id, feld in self._erkennungsfelder:
                stammdaten.objekt_erkennungstext_setzen(
                    self._verbindung, objekt_id, feld.text()
                )
            haus_id = self._standard_haus.currentData()
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_STANDARD_HAUS,
                str(haus_id) if haus_id is not None else "",
            )
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_AUTO_IMPORT,
                "1" if self._auto_import.isChecked() else "0",
            )
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_EINRICHTUNG, "1"
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        QMessageBox.information(
            self, "Eingerichtet",
            "Die automatische Buchungserfassung ist aktiv. Beim nächsten "
            "PDF-Import werden erkannte Buchungen direkt verbucht."
        )
        self.accept()
