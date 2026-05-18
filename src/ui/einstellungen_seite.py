"""Einstellungen: PIN ändern, Backup-Ordner, manuelle Sicherung.

Zeigt außerdem den Speicherort der Datenbank an.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from src.db.einstellungen import (
    SCHLUESSEL_BACKUP_PFAD,
    einstellung_lesen,
    einstellung_schreiben,
)
from src.logic.backup import backup_ziel, datensicherung_durchfuehren
from src.utils import paths, security


class PinAendernDialog(QDialog):
    """Dialog zum Ändern des PINs (mit Prüfung des bisherigen PINs)."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self.setModal(True)
        self.setWindowTitle("PIN ändern")

        layout = QVBoxLayout(self)
        formular = QFormLayout()
        self._feld_alt = QLineEdit()
        self._feld_alt.setEchoMode(QLineEdit.Password)
        self._feld_neu = QLineEdit()
        self._feld_neu.setEchoMode(QLineEdit.Password)
        self._feld_neu_wdh = QLineEdit()
        self._feld_neu_wdh.setEchoMode(QLineEdit.Password)
        formular.addRow("Bisheriger PIN:", self._feld_alt)
        formular.addRow("Neuer PIN:", self._feld_neu)
        formular.addRow("Neuer PIN (Wdh.):", self._feld_neu_wdh)
        layout.addLayout(formular)

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("PIN speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _speichern(self) -> None:
        """Prüft die Eingaben und speichert den neuen PIN."""
        if not security.pin_pruefen(self._verbindung, self._feld_alt.text()):
            QMessageBox.warning(self, "Falscher PIN",
                                "Der bisherige PIN ist nicht korrekt.")
            return
        neu = self._feld_neu.text()
        if len(neu) < security.MIN_PIN_LAENGE:
            QMessageBox.warning(
                self, "PIN zu kurz",
                f"Der neue PIN muss mindestens {security.MIN_PIN_LAENGE} "
                "Zeichen lang sein."
            )
            return
        if neu != self._feld_neu_wdh.text():
            QMessageBox.warning(self, "Eingaben verschieden",
                                "Die beiden neuen PIN-Eingaben stimmen "
                                "nicht überein.")
            return
        try:
            security.pin_festlegen(self._verbindung, neu)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        QMessageBox.information(self, "PIN geändert",
                                "Der PIN wurde erfolgreich geändert.")
        self.accept()


class EinstellungenSeite(QWidget):
    """Einstellungsbereich der Anwendung."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        # --- Sicherheit ---
        sicherheit = QGroupBox("Sicherheit")
        sicherheit_layout = QVBoxLayout(sicherheit)
        knopf_pin = QPushButton("PIN ändern …")
        knopf_pin.clicked.connect(self._pin_aendern)
        sicherheit_layout.addWidget(knopf_pin)
        layout.addWidget(sicherheit)

        # --- Datensicherung ---
        backup = QGroupBox("Datensicherung")
        backup_layout = QVBoxLayout(backup)
        self._backup_label = QLabel()
        self._backup_label.setWordWrap(True)
        backup_layout.addWidget(self._backup_label)

        backup_knoepfe = QHBoxLayout()
        knopf_ordner = QPushButton("Backup-Ordner wählen …")
        knopf_ordner.clicked.connect(self._ordner_waehlen)
        knopf_sichern = QPushButton("Jetzt sichern")
        knopf_sichern.clicked.connect(self._jetzt_sichern)
        backup_knoepfe.addWidget(knopf_ordner)
        backup_knoepfe.addWidget(knopf_sichern)
        backup_knoepfe.addStretch()
        backup_layout.addLayout(backup_knoepfe)
        layout.addWidget(backup)

        # --- Information ---
        info = QGroupBox("Speicherort")
        info_layout = QVBoxLayout(info)
        db_info = QLabel(f"Datenbank: {paths.datenbank_pfad()}")
        db_info.setWordWrap(True)
        db_info.setTextInteractionFlags(db_info.textInteractionFlags())
        info_layout.addWidget(db_info)
        info_layout.addWidget(QLabel(
            "Beim Schließen der App wird automatisch eine Sicherung "
            "erstellt."
        ))
        layout.addWidget(info)
        layout.addStretch()

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Aktualisiert die Anzeige des Backup-Ordners."""
        self._backup_label.setText(
            f"Aktueller Backup-Ordner:\n{backup_ziel(self._verbindung)}"
        )

    def _pin_aendern(self) -> None:
        PinAendernDialog(self._verbindung, parent=self).exec()

    def _ordner_waehlen(self) -> None:
        ordner = QFileDialog.getExistingDirectory(
            self, "Backup-Ordner wählen"
        )
        if not ordner:
            return
        try:
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_BACKUP_PFAD, ordner
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _jetzt_sichern(self) -> None:
        try:
            ziel = datensicherung_durchfuehren(self._verbindung)
        except OSError as fehler:
            QMessageBox.critical(self, "Sicherung fehlgeschlagen", str(fehler))
            return
        QMessageBox.information(
            self, "Sicherung erstellt",
            f"Datenbank und Belege wurden gesichert nach:\n{ziel}"
        )
