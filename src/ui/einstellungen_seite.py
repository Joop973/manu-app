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
    PIN_AKTIV,
    PIN_AUS,
    SCHLUESSEL_BACKUP_PFAD,
    SCHLUESSEL_PIN_MODUS,
    einstellung_lesen,
    einstellung_schreiben,
)
from src.logic.backup import backup_ziel, datensicherung_durchfuehren
from src.ui.login_dialog import PinFestlegenDialog
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

        # --- Sicherheit (PIN) ---
        sicherheit = QGroupBox("Sicherheit")
        self._sicherheit_layout = QVBoxLayout(sicherheit)
        layout.addWidget(sicherheit)
        self._sicherheit_neu_aufbauen()

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

        # --- Rückgängig (Aktions-Log) ---
        rueckgang = QGroupBox("Letzte Änderungen rückgängig machen")
        rueck_layout = QVBoxLayout(rueckgang)
        rueck_layout.addWidget(QLabel(
            "Versehentlich gelöscht oder geändert? Hier kannst du die "
            "letzten Aktionen einzeln zurücknehmen."
        ))
        knopf_aktionen = QPushButton("Aktions-Log öffnen …")
        knopf_aktionen.clicked.connect(self._aktions_log_oeffnen)
        rueck_layout.addWidget(knopf_aktionen)
        layout.addWidget(rueckgang)

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
        """Aktualisiert Backup-Anzeige und Sicherheitsbereich."""
        self._backup_label.setText(
            f"Aktueller Backup-Ordner:\n{backup_ziel(self._verbindung)}"
        )
        self._sicherheit_neu_aufbauen()

    def _sicherheit_neu_aufbauen(self) -> None:
        """Baut den PIN-Bereich passend zum aktuellen PIN-Modus auf."""
        while self._sicherheit_layout.count():
            element = self._sicherheit_layout.takeAt(0)
            widget = element.widget()
            if widget is not None:
                widget.deleteLater()

        modus = einstellung_lesen(self._verbindung, SCHLUESSEL_PIN_MODUS)
        if modus == PIN_AKTIV:
            self._sicherheit_layout.addWidget(
                QLabel("PIN-Schutz ist aktiv.")
            )
            knopf_aendern = QPushButton("PIN ändern …")
            knopf_aendern.clicked.connect(self._pin_aendern)
            knopf_entfernen = QPushButton("PIN-Schutz entfernen")
            knopf_entfernen.clicked.connect(self._pin_entfernen)
            self._sicherheit_layout.addWidget(knopf_aendern)
            self._sicherheit_layout.addWidget(knopf_entfernen)
        else:
            self._sicherheit_layout.addWidget(QLabel(
                "Kein PIN-Schutz. Die App startet ohne Anmeldung."
            ))
            knopf_einrichten = QPushButton("PIN-Schutz einrichten …")
            knopf_einrichten.clicked.connect(self._pin_einrichten)
            self._sicherheit_layout.addWidget(knopf_einrichten)

    def _pin_aendern(self) -> None:
        PinAendernDialog(self._verbindung, parent=self).exec()

    def _pin_entfernen(self) -> None:
        antwort = QMessageBox.question(
            self, "PIN-Schutz entfernen",
            "Den PIN-Schutz wirklich entfernen? Die App startet danach "
            "ohne Anmeldung.",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            security.pin_entfernen(self._verbindung)
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_PIN_MODUS, PIN_AUS
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self._sicherheit_neu_aufbauen()

    def _pin_einrichten(self) -> None:
        dialog = PinFestlegenDialog(self._verbindung, parent=self)
        if dialog.exec() != QDialog.Accepted:
            return
        try:
            einstellung_schreiben(
                self._verbindung, SCHLUESSEL_PIN_MODUS, PIN_AKTIV
            )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self._sicherheit_neu_aufbauen()

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

    def _aktions_log_oeffnen(self) -> None:
        AktionsLogDialog(self._verbindung, parent=self).exec()


class AktionsLogDialog(QDialog):
    """Liste der letzten Aktionen mit Knopf zum Rückgängig-Machen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        from src.db import aktionen
        from src.ui.tabelle import tabelle_vorbereiten
        from PySide6.QtCore import Qt
        from PySide6.QtWidgets import QTableWidget, QTableWidgetItem
        self._verbindung = verbindung
        self._aktionen = aktionen
        self._Qt = Qt
        self._tw_item = QTableWidgetItem
        self.setModal(True)
        self.setWindowTitle("Aktions-Log")
        self.resize(720, 420)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Die letzten 50 Aktionen. Markiere eine Zeile und drücke "
            "den Rückgängig-Knopf, um sie zurückzunehmen."
        ))

        self._tabelle = QTableWidget(0, 4)
        self._tabelle.setHorizontalHeaderLabels(
            ["Zeit", "Aktion", "Tabelle", "Status"]
        )
        tabelle_vorbereiten(self._tabelle, sortierbar=False)
        layout.addWidget(self._tabelle)
        self._tabelle_fuellen()

        knoepfe = QDialogButtonBox()
        knopf_undo = knoepfe.addButton(
            "Rückgängig", QDialogButtonBox.ActionRole
        )
        knopf_undo.clicked.connect(self._rueckgaengig)
        knoepfe.addButton("Schließen", QDialogButtonBox.RejectRole)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _tabelle_fuellen(self) -> None:
        zeilen = self._aktionen.aktionen_laden(self._verbindung, anzahl=50)
        self._tabelle.setRowCount(len(zeilen))
        for index, zeile in enumerate(zeilen):
            zeit_item = self._tw_item(zeile["zeit"])
            zeit_item.setData(self._Qt.UserRole, zeile["id"])
            self._tabelle.setItem(index, 0, zeit_item)
            self._tabelle.setItem(index, 1, self._tw_item(zeile["art"]))
            self._tabelle.setItem(index, 2, self._tw_item(zeile["tabelle"]))
            status = "zurückgesetzt" if zeile["zurueckgesetzt"] else "aktiv"
            self._tabelle.setItem(index, 3, self._tw_item(status))

    def _rueckgaengig(self) -> None:
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            QMessageBox.information(self, "Keine Aktion",
                                    "Bitte zuerst eine Zeile auswählen.")
            return
        aktion_id = self._tabelle.item(zeile, 0).data(self._Qt.UserRole)
        try:
            meldung = self._aktionen.aktion_zuruecknehmen(
                self._verbindung, aktion_id
            )
        except (ValueError, sqlite3.Error) as fehler:
            QMessageBox.critical(self, "Konnte nicht zurückgenommen werden",
                                 str(fehler))
            return
        QMessageBox.information(self, "Erledigt", meldung)
        self._tabelle_fuellen()
