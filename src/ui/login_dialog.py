"""Dialoge für die PIN-Sicherung.

* ``PinFestlegenDialog`` — beim allerersten Start: neuen PIN vergeben.
* ``LoginDialog``         — bei jedem weiteren Start: PIN eingeben.

Der LoginDialog begrenzt die Fehlversuche: nach fünf falschen
Eingaben wird die Eingabe für 30 Sekunden gesperrt (mit Countdown).
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
)

from src.utils import security

# Login-Schutz: Anzahl erlaubter Fehlversuche und Sperrdauer.
MAX_FEHLVERSUCHE = 5
SPERRE_SEKUNDEN = 30


class PinFestlegenDialog(QDialog):
    """Erstmaliges Festlegen des PINs (zweifache Eingabe zur Kontrolle)."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setWindowTitle("PIN festlegen")
        self.setModal(True)

        layout = QVBoxLayout(self)
        hinweis = QLabel(
            "Willkommen bei Manu.\n\n"
            "Bitte vergeben Sie einen PIN zum Schutz Ihrer Daten "
            f"(mindestens {security.MIN_PIN_LAENGE} Zeichen).\n\n"
            "Wichtig: Der PIN kann nicht wiederhergestellt werden. "
            "Bewahren Sie ihn sicher auf."
        )
        hinweis.setWordWrap(True)
        layout.addWidget(hinweis)

        formular = QFormLayout()
        self._feld_pin = QLineEdit()
        self._feld_pin.setEchoMode(QLineEdit.Password)
        self._feld_pin_wdh = QLineEdit()
        self._feld_pin_wdh.setEchoMode(QLineEdit.Password)
        formular.addRow("PIN:", self._feld_pin)
        formular.addRow("PIN wiederholen:", self._feld_pin_wdh)
        layout.addLayout(formular)

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("PIN speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._pin_speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _pin_speichern(self) -> None:
        """Validiert die Eingabe und speichert den PIN-Hash."""
        pin = self._feld_pin.text()
        pin_wdh = self._feld_pin_wdh.text()

        if len(pin) < security.MIN_PIN_LAENGE:
            QMessageBox.warning(
                self,
                "PIN zu kurz",
                f"Der PIN muss mindestens {security.MIN_PIN_LAENGE} "
                "Zeichen lang sein.",
            )
            return
        if pin != pin_wdh:
            QMessageBox.warning(
                self,
                "Eingaben verschieden",
                "Die beiden PIN-Eingaben stimmen nicht überein.",
            )
            return

        try:
            security.pin_festlegen(self._verbindung, pin)
        except sqlite3.Error as fehler:
            QMessageBox.critical(
                self,
                "Datenbankfehler",
                f"Der PIN konnte nicht gespeichert werden:\n{fehler}",
            )
            return

        self.accept()


class LoginDialog(QDialog):
    """Anmeldung bei jedem weiteren Start der App."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._fehlversuche = 0
        self._restsekunden = 0

        self.setWindowTitle("Anmeldung")
        self.setModal(True)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Bitte geben Sie Ihren PIN ein."))

        formular = QFormLayout()
        self._feld_pin = QLineEdit()
        self._feld_pin.setEchoMode(QLineEdit.Password)
        self._feld_pin.returnPressed.connect(self._anmelden)
        formular.addRow("PIN:", self._feld_pin)
        layout.addLayout(formular)

        # Statuszeile (Fehlermeldung / Countdown der Sperre)
        self._status = QLabel("")
        self._status.setWordWrap(True)
        layout.addWidget(self._status)

        # Hinweis "PIN vergessen?"
        self._pin_vergessen = QPushButton("PIN vergessen?")
        self._pin_vergessen.setFlat(True)
        self._pin_vergessen.clicked.connect(self._pin_vergessen_hinweis)
        layout.addWidget(self._pin_vergessen)

        self._knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        self._knoepfe.button(QDialogButtonBox.Ok).setText("Anmelden")
        self._knoepfe.button(QDialogButtonBox.Cancel).setText("Beenden")
        self._knoepfe.accepted.connect(self._anmelden)
        self._knoepfe.rejected.connect(self.reject)
        layout.addWidget(self._knoepfe)

        # Timer für den Countdown der Sperre
        self._timer = QTimer(self)
        self._timer.setInterval(1000)
        self._timer.timeout.connect(self._countdown)

    def _pin_vergessen_hinweis(self) -> None:
        """Erklärt, dass ein vergessener PIN nicht wiederherstellbar ist."""
        QMessageBox.information(
            self,
            "PIN vergessen",
            "Der PIN ist nur als verschlüsselter Hash gespeichert und "
            "kann nicht wiederhergestellt werden.\n\n"
            "Ohne den richtigen PIN gibt es keinen Zugang zu den Daten. "
            "Sollte eine Datensicherung (controlling_backup.db) auf einem "
            "anderen Stand mit bekanntem PIN existieren, kann diese "
            "verwendet werden.",
        )

    def _anmelden(self) -> None:
        """Prüft den eingegebenen PIN."""
        if self._restsekunden > 0:
            return  # Eingabe ist gesperrt

        pin = self._feld_pin.text()
        try:
            korrekt = security.pin_pruefen(self._verbindung, pin)
        except sqlite3.Error as fehler:
            QMessageBox.critical(
                self,
                "Datenbankfehler",
                f"Die Anmeldung schlug fehl:\n{fehler}",
            )
            return

        if korrekt:
            self.accept()
            return

        # Falscher PIN
        self._fehlversuche += 1
        self._feld_pin.clear()
        if self._fehlversuche >= MAX_FEHLVERSUCHE:
            self._sperre_starten()
        else:
            verbleibend = MAX_FEHLVERSUCHE - self._fehlversuche
            self._status.setText(
                f"Falscher PIN. Noch {verbleibend} Versuch(e) bis zur Sperre."
            )
            self._feld_pin.setFocus()

    def _sperre_starten(self) -> None:
        """Sperrt die Eingabe für die festgelegte Dauer."""
        self._restsekunden = SPERRE_SEKUNDEN
        self._eingabe_sperren(True)
        self._status.setText(
            f"Zu viele Fehlversuche. Gesperrt für noch {self._restsekunden} s."
        )
        self._timer.start()

    def _countdown(self) -> None:
        """Zählt die Sperre herunter und gibt die Eingabe danach wieder frei."""
        self._restsekunden -= 1
        if self._restsekunden > 0:
            self._status.setText(
                f"Zu viele Fehlversuche. Gesperrt für noch "
                f"{self._restsekunden} s."
            )
            return
        self._timer.stop()
        self._fehlversuche = 0
        self._eingabe_sperren(False)
        self._status.setText("")
        self._feld_pin.setFocus()

    def _eingabe_sperren(self, gesperrt: bool) -> None:
        """Schaltet PIN-Feld und Anmelden-Knopf (de)aktiv."""
        self._feld_pin.setEnabled(not gesperrt)
        self._knoepfe.button(QDialogButtonBox.Ok).setEnabled(not gesperrt)
