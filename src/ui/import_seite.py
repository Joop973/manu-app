"""Import-Bereich: Kontoauszug-PDF einlesen und Belege archivieren.

Beim PDF-Import werden die erkannten Buchungen in einer Vorschau
gezeigt: automatisch zugeordnete Zeilen grün, bestätigungspflichtige
gelb. Erst „Alle übernehmen" schreibt die Buchungen in die Datenbank.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal
from pathlib import Path

from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen, muster, stammdaten
from src.logic import lernsystem
from src.logic.belege import beleg_archivieren
from src.logic.pdf_import import (
    buchungszeilen_aus_text, rohtext_lesen, saldo_pruefen,
)
from src.ui.tabelle import tabelle_vorbereiten
from src.utils.eingaben import betrag_formatieren, datum_anzeigen

# Hintergrundfarben der Vorschau-Zeilen.
_FARBE_AUTO = QColor("#d7f0d7")      # grün — sicher zugeordnet
_FARBE_PRUEFEN = QColor("#fbf2c4")   # gelb — Bestätigung nötig
_FARBE_DUBLETTE = QColor("#f3cba6")  # orange — mögliche Dublette

# Anzeigetexte je Status.
_STATUS_TEXT = {
    "auto": "automatisch",
    "unsicher": "unsicher (Betrag prüfen)",
    "neu": "neu — bitte zuordnen",
}


def _haus_combo(verbindung: sqlite3.Connection, objekt_id: int | None) -> QComboBox:
    """Erzeugt ein Auswahlfeld für Häuser mit Vorauswahl."""
    combo = QComboBox()
    combo.addItem("— bitte wählen —", None)
    for haus in stammdaten.objekte_laden(verbindung):
        combo.addItem(haus["name"], haus["id"])
    if objekt_id is not None:
        index = combo.findData(objekt_id)
        if index >= 0:
            combo.setCurrentIndex(index)
    return combo


def _kategorie_combo(
    verbindung: sqlite3.Connection, kategorie_id: int | None
) -> QComboBox:
    """Erzeugt ein Auswahlfeld für Kategorien mit Vorauswahl."""
    combo = QComboBox()
    combo.addItem("— bitte wählen —", None)
    for typ, bezeichnung in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
        for kategorie in stammdaten.kategorien_laden(verbindung, typ):
            combo.addItem(f"{kategorie['name']} ({bezeichnung})", kategorie["id"])
    if kategorie_id is not None:
        index = combo.findData(kategorie_id)
        if index >= 0:
            combo.setCurrentIndex(index)
    return combo


def _mieter_combo_fuellen(
    combo: QComboBox,
    verbindung: sqlite3.Connection,
    objekt_id: int | None,
    auswahl_mieter_id: int | None = None,
) -> None:
    """Befüllt ein Mieter-Auswahlfeld passend zum gewählten Haus.

    Der erste Eintrag „— kein Mieter —" ist der leere Standard-Slot, der
    bleibt, wenn die Buchung niemandem zugeordnet ist (z. B. Versicherung).
    """
    bisher = auswahl_mieter_id if auswahl_mieter_id is not None \
        else combo.currentData()
    combo.blockSignals(True)
    combo.clear()
    combo.addItem("— kein Mieter —", None)
    if objekt_id is not None:
        for mieter in stammdaten.mieter_laden(verbindung, objekt_id):
            combo.addItem(mieter["name"], mieter["id"])
    if bisher is not None:
        index = combo.findData(bisher)
        if index >= 0:
            combo.setCurrentIndex(index)
    combo.blockSignals(False)


class ImportVorschauDialog(QDialog):
    """Zeigt die erkannten Buchungen vor dem Übernehmen zur Kontrolle."""

    SPALTE_HAUS = 3
    SPALTE_KATEGORIE = 4
    SPALTE_MIETER = 5
    SPALTE_STATUS = 6

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        kandidaten: list[dict],
        pruefung: dict | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._kandidaten = kandidaten
        self.setModal(True)
        self.setWindowTitle("Import-Vorschau")
        self.resize(900, 480)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            f"{len(kandidaten)} Buchung(en) erkannt. Grüne Zeilen sind "
            "automatisch zugeordnet, gelbe brauchen Haus und Kategorie."
        ))
        if pruefung is not None:
            layout.addWidget(self._saldo_label(pruefung))

        self._tabelle = QTableWidget(len(kandidaten), 7)
        self._tabelle.setHorizontalHeaderLabels(
            ["Datum", "Betrag", "Empfänger / Zweck", "Haus", "Kategorie",
             "Mieter", "Status"]
        )
        tabelle_vorbereiten(self._tabelle, sortierbar=False)
        layout.addWidget(self._tabelle)

        self._tabelle_fuellen()

        knoepfe = QDialogButtonBox()
        self._knopf_uebernehmen = knoepfe.addButton(
            "Alle übernehmen", QDialogButtonBox.AcceptRole
        )
        knoepfe.addButton("Abbrechen", QDialogButtonBox.RejectRole)
        self._knopf_uebernehmen.clicked.connect(self._uebernehmen)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _saldo_label(self, pruefung: dict) -> QLabel:
        """Liefert eine grüne/rote Plausibilitätsmeldung zum Endsaldo."""
        if (pruefung["alter_saldo"] is None
                or pruefung["neuer_saldo"] is None):
            text = ("Plausibilitätsprüfung nicht möglich (Anfangs-/"
                    "Endsaldo nicht erkannt).")
            farbe = "#fbf2c4"
        elif pruefung["stimmt"]:
            text = (
                f"Saldo stimmt: {betrag_formatieren(pruefung['alter_saldo'])}"
                f" + {betrag_formatieren(pruefung['summe_buchungen'])}"
                f" = {betrag_formatieren(pruefung['neuer_saldo'])} €"
            )
            farbe = "#d7f0d7"
        else:
            differenz = (pruefung["neuer_saldo"]
                         - (pruefung["berechneter_endsaldo"] or Decimal("0")))
            text = (
                "Saldo stimmt NICHT — Differenz "
                f"{betrag_formatieren(differenz)} €. "
                "Bitte vor dem Übernehmen prüfen."
            )
            farbe = "#f3cba6"
        label = QLabel(text)
        label.setStyleSheet(
            f"background-color: {farbe}; padding: 6px; border-radius: 4px;"
        )
        return label

    def _tabelle_fuellen(self) -> None:
        """Baut die Vorschautabelle mit Auswahlfeldern je Zeile auf."""
        for zeile, kandidat in enumerate(self._kandidaten):
            if kandidat.get("dublette"):
                farbe = _FARBE_DUBLETTE
            elif kandidat["status"] == "auto":
                farbe = _FARBE_AUTO
            else:
                farbe = _FARBE_PRUEFEN

            status_text = _STATUS_TEXT.get(
                kandidat["status"], kandidat["status"]
            )
            if kandidat.get("dublette"):
                status_text += " — mögliche Dublette"

            datum_item = QTableWidgetItem(datum_anzeigen(kandidat["datum"]))
            betrag_item = QTableWidgetItem(
                f"{betrag_formatieren(kandidat['betrag'])} €"
            )
            text_item = QTableWidgetItem(kandidat["text"])
            status_item = QTableWidgetItem(status_text)
            for spalte, item in enumerate(
                (datum_item, betrag_item, text_item)
            ):
                item.setBackground(farbe)
                self._tabelle.setItem(zeile, spalte, item)
            status_item.setBackground(farbe)
            self._tabelle.setItem(zeile, self.SPALTE_STATUS, status_item)

            haus_combo = _haus_combo(self._verbindung, kandidat["objekt_id"])
            self._tabelle.setCellWidget(zeile, self.SPALTE_HAUS, haus_combo)
            self._tabelle.setCellWidget(
                zeile, self.SPALTE_KATEGORIE,
                _kategorie_combo(self._verbindung, kandidat["kategorie_id"]),
            )

            mieter_combo = QComboBox()
            _mieter_combo_fuellen(
                mieter_combo, self._verbindung,
                kandidat["objekt_id"], None,
            )
            self._tabelle.setCellWidget(zeile, self.SPALTE_MIETER, mieter_combo)
            # Bei Hauswechsel das Mieter-Combo derselben Zeile mit
            # passenden Mietern neu befüllen.
            haus_combo.currentIndexChanged.connect(
                lambda _, hk=haus_combo, mk=mieter_combo:
                _mieter_combo_fuellen(mk, self._verbindung, hk.currentData())
            )

    def _uebernehmen(self) -> None:
        """Prüft die Zuordnung und schreibt alle Buchungen in die Datenbank."""
        zuordnung: list[tuple[int, int, int | None]] = []
        for zeile in range(len(self._kandidaten)):
            objekt_id = self._tabelle.cellWidget(
                zeile, self.SPALTE_HAUS
            ).currentData()
            kategorie_id = self._tabelle.cellWidget(
                zeile, self.SPALTE_KATEGORIE
            ).currentData()
            mieter_id = self._tabelle.cellWidget(
                zeile, self.SPALTE_MIETER
            ).currentData()
            if objekt_id is None or kategorie_id is None:
                QMessageBox.warning(
                    self, "Zuordnung unvollständig",
                    f"Zeile {zeile + 1}: Bitte Haus und Kategorie wählen."
                )
                return
            zuordnung.append((objekt_id, kategorie_id, mieter_id))

        try:
            for kandidat, (objekt_id, kategorie_id, mieter_id) in zip(
                self._kandidaten, zuordnung
            ):
                buchungen.buchung_anlegen(
                    self._verbindung,
                    kandidat["datum"],
                    abs(kandidat["betrag"]),
                    objekt_id,
                    kategorie_id,
                    kandidat["text"],
                    None,
                    "import",
                    mieter_id=mieter_id,
                )
                erkennung = lernsystem.erkennungstext_bilden(kandidat["norm"])
                muster.muster_speichern(
                    self._verbindung, erkennung, objekt_id, kategorie_id
                )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return

        QMessageBox.information(
            self, "Import abgeschlossen",
            f"{len(self._kandidaten)} Buchung(en) wurden übernommen."
        )
        self.accept()


class BelegZuordnenDialog(QDialog):
    """Ordnet eine Belegdatei einer bestehenden Buchung zu."""

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        datei_pfad: str,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._datei_pfad = datei_pfad
        self.setModal(True)
        self.setWindowTitle("Beleg archivieren")
        self.resize(760, 440)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            f"Datei: {Path(datei_pfad).name}\n\n"
            "Bitte die Buchung wählen, zu der dieser Beleg gehört."
        ))

        self._buchungen = buchungen.buchungen_laden(verbindung)
        self._tabelle = QTableWidget(len(self._buchungen), 5)
        self._tabelle.setHorizontalHeaderLabels(
            ["Datum", "Betrag", "Haus", "Kategorie", "Beschreibung"]
        )
        tabelle_vorbereiten(self._tabelle, sortierbar=False)
        for zeile, buchung in enumerate(self._buchungen):
            werte = [
                datum_anzeigen(buchung["datum"]),
                f"{betrag_formatieren(buchung['betrag'])} €",
                buchung["objekt_name"] or "—",
                buchung["kategorie_name"] or "—",
                buchung["beschreibung"] or "",
            ]
            for spalte, wert in enumerate(werte):
                self._tabelle.setItem(zeile, spalte, QTableWidgetItem(wert))
        layout.addWidget(self._tabelle)

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Beleg zuordnen")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._zuordnen)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _zuordnen(self) -> None:
        """Archiviert die Datei und verknüpft sie mit der gewählten Buchung."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        buchung = self._buchungen[zeile]
        jahr = 2000
        if buchung["datum"]:
            jahr = int(buchung["datum"][:4])
        try:
            relativer_pfad = beleg_archivieren(self._datei_pfad, jahr)
            buchungen.buchung_beleg_setzen(
                self._verbindung, buchung["id"], relativer_pfad
            )
        except (OSError, FileNotFoundError) as fehler:
            QMessageBox.critical(self, "Beleg-Fehler", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        QMessageBox.information(
            self, "Beleg archiviert",
            f"Der Beleg wurde abgelegt unter:\n{relativer_pfad}"
        )
        self.accept()


class ImportSeite(QWidget):
    """Einstiegsseite für PDF-Import und Beleg-Archivierung."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel(
            "Hier können Sie einen Volksbank-Kontoauszug (PDF) einlesen "
            "oder einen Beleg archivieren."
        ))

        knopf_pdf = QPushButton("Kontoauszug importieren (PDF)")
        knopf_pdf.clicked.connect(self._kontoauszug_importieren)
        knopf_beleg = QPushButton("Beleg archivieren")
        knopf_beleg.clicked.connect(self._beleg_archivieren)

        knopfzeile = QHBoxLayout()
        knopfzeile.addWidget(knopf_pdf)
        knopfzeile.addWidget(knopf_beleg)
        knopfzeile.addStretch()
        layout.addLayout(knopfzeile)

        self._hinweis = QLabel(
            "Hinweis: Das Kontoauszug-PDF wird nur ausgelesen, nicht "
            "gespeichert. Erkannte Buchungen werden vor dem Übernehmen "
            "in einer Vorschau angezeigt."
        )
        self._hinweis.setWordWrap(True)
        layout.addWidget(self._hinweis)
        layout.addStretch()

    def aktualisieren(self) -> None:
        """Die Import-Seite hält keinen eigenen Zustand vor."""

    def _kontoauszug_importieren(self) -> None:
        pfad, _ = QFileDialog.getOpenFileName(
            self, "Kontoauszug (PDF) auswählen", "", "PDF-Dateien (*.pdf)"
        )
        if not pfad:
            return
        try:
            rohtext = rohtext_lesen(pfad)
            zeilen = buchungszeilen_aus_text(rohtext)
        except Exception as fehler:  # noqa: BLE001 - Anzeige statt Absturz
            QMessageBox.critical(
                self, "PDF konnte nicht gelesen werden", str(fehler)
            )
            return

        if not zeilen:
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Information)
            box.setWindowTitle("Keine Buchungen erkannt")
            box.setText(
                "Im PDF wurden keine Buchungszeilen gefunden.\n\n"
                "Unter „Details anzeigen“ sehen Sie den ausgelesenen "
                "Text — daran lässt sich erkennen, ob das PDF lesbar ist."
            )
            box.setDetailedText(
                rohtext or "(Es konnte kein Text aus dem PDF gelesen werden.)"
            )
            box.exec()
            return

        pruefung = saldo_pruefen(rohtext, zeilen)
        kandidaten = [
            lernsystem.klassifizieren(
                self._verbindung, zeile["datum"], zeile["betrag"],
                zeile["text"],
            )
            for zeile in zeilen
        ]
        ImportVorschauDialog(
            self._verbindung, kandidaten, pruefung=pruefung, parent=self,
        ).exec()

    def _beleg_archivieren(self) -> None:
        pfad, _ = QFileDialog.getOpenFileName(self, "Beleg auswählen")
        if not pfad:
            return
        BelegZuordnenDialog(self._verbindung, pfad, parent=self).exec()
