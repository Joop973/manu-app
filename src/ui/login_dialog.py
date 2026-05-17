"""Dialoge für die PIN-Sicherung.

* ``PinFestlegenDialog`` — beim allerersten Start: neuen PIN vergeben.
* ``LoginDialog``         — bei jedem weiteren Start: PIN eingeben.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QVBoxLayout,
)

from src.utils import security


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
            f"(mindestens {security.MIN_PIN_LAENGE} Zeichen)."
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
        self.setWindowTitle("Anmeldung")
        self.setModal(True)

        layout = QVBoxLayout(self)
        hinweis = QLabel("Bitte geben Sie Ihren PIN ein.")
        layout.addWidget(hinweis)

        formular = QFormLayout()
        self._feld_pin = QLineEdit()
        self._feld_pin.setEchoMode(QLineEdit.Password)
        self._feld_pin.returnPressed.connect(self._anmelden)
        formular.addRow("PIN:", self._feld_pin)
        layout.addLayout(formular)

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Anmelden")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Beenden")
        knoepfe.accepted.connect(self._anmelden)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _anmelden(self) -> None:
        """Prüft den eingegebenen PIN."""
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
        else:
            QMessageBox.warning(
                self,
                "Falscher PIN",
                "Der eingegebene PIN ist nicht korrekt.",
            )
            self._feld_pin.clear()
            self._feld_pin.setFocus()
