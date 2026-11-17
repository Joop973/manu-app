"""Buchungserfassung: Tabelle mit Filter, Anlegen, Bearbeiten, Löschen.

Buchungen können manuell erfasst werden; optional lässt sich ein Beleg
anhängen, der ins Archiv ``belege/<jahr>/`` kopiert wird.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from decimal import Decimal
from pathlib import Path

from PySide6.QtCore import QDate, Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from src.db import buchungen, stammdaten
from src.logic import steuer
from src.logic.belege import beleg_absolut, beleg_archivieren
from src.ui.tabelle import SortierItem, tabelle_vorbereiten
from src.utils.eingaben import (
    MONATSNAMEN,
    ValidierungsFehler,
    betrag_formatieren,
    betrag_parsen,
    datum_anzeigen,
)


class BuchungDialog(QDialog):
    """Formular zum Anlegen oder Bearbeiten einer Buchung."""

    def __init__(
        self,
        verbindung: sqlite3.Connection,
        buchung_id: int | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._verbindung = verbindung
        self._buchung_id = buchung_id
        self._beleg_bestehend: str | None = None  # relativer Pfad aus der DB
        self._beleg_neu: str | None = None        # neu gewählte Quelldatei
        self.setModal(True)
        self.setWindowTitle("Buchung bearbeiten" if buchung_id else "Neue Buchung")

        layout = QVBoxLayout(self)
        formular = QFormLayout()

        self._feld_datum = QDateEdit()
        self._feld_datum.setCalendarPopup(True)
        self._feld_datum.setDisplayFormat("dd.MM.yyyy")
        self._feld_datum.setDate(QDate.currentDate())
        formular.addRow("Datum:", self._feld_datum)

        self._feld_betrag = QLineEdit("0,00")
        formular.addRow("Betrag (€):", self._feld_betrag)

        # Zahlungsrichtung wie auf dem Kontoauszug. Ein Geldeingang auf
        # einer Ausgabe-Kategorie wird zur Erstattung (mindert die Kosten),
        # ein Geldausgang auf einer Einnahme-Kategorie zur Rückzahlung.
        self._feld_richtung = QComboBox()
        self._feld_richtung.addItem("Geldausgang (−)", -1)
        self._feld_richtung.addItem("Geldeingang (+)", 1)
        self._richtung_angefasst = False
        self._feld_richtung.activated.connect(self._richtung_gewaehlt)
        self._feld_richtung.currentIndexChanged.connect(
            self._hinweise_aktualisieren)
        formular.addRow("Zahlungsrichtung:", self._feld_richtung)

        self._feld_haus = QComboBox()
        for haus in stammdaten.objekte_laden(verbindung):
            text = haus["name"]
            if not haus["aktiv"]:
                text += "  (inaktiv)"
            self._feld_haus.addItem(text, haus["id"])
        self._feld_haus.currentIndexChanged.connect(self._mieter_combo_fuellen)
        formular.addRow("Haus:", self._feld_haus)

        # Kategorie: frei beschreibbar — ein neu getippter Name wird beim
        # Speichern automatisch als Kategorie angelegt (Rahmen-Prinzip).
        self._feld_kategorie = QComboBox()
        self._feld_kategorie.setEditable(True)
        self._feld_kategorie.setInsertPolicy(QComboBox.NoInsert)
        self._feld_kategorie.setProperty("kategorie_typ", "ausgabe")
        # Typ und Steuer-Voreinstellung je Kategorie (für Hinweise).
        self._kategorie_info: dict[int, dict] = {}
        for typ, bezeichnung in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
            for kategorie in stammdaten.kategorien_laden(verbindung, typ):
                text = f"{kategorie['name']} ({bezeichnung})"
                if not kategorie["aktiv"]:
                    text += " – inaktiv"
                self._feld_kategorie.addItem(text, kategorie["id"])
                self._kategorie_info[kategorie["id"]] = {
                    "typ": typ,
                    "art": kategorie["steuer_art"],
                    "prozent": steuer.dezimal(kategorie["steuer_prozent"]),
                }
        kategorie_zeile = QVBoxLayout()
        kategorie_zeile.setSpacing(2)
        kategorie_zeile.addWidget(self._feld_kategorie)
        kategorie_hinweis = QLabel(
            "Neue Kategorie? Einfach eintippen — mit „(Einnahme)“ am Ende "
            "wird sie als Einnahme angelegt, sonst als Ausgabe."
        )
        kategorie_hinweis.setStyleSheet("color: #666666; font-size: 8pt;")
        kategorie_hinweis.setWordWrap(True)
        kategorie_zeile.addWidget(kategorie_hinweis)
        formular.addRow("Kategorie:", kategorie_zeile)

        # Mieter-Bezug (optional). Steuert auch die Anzeige
        # „Mieteinnahme von <Name>" in der Buchungsliste.
        self._feld_mieter = QComboBox()
        self._feld_mieter.setProperty("haus_combo", self._feld_haus)
        self._mieter_combo_fuellen()
        from src.ui.import_seite import _mieter_combo_aktivieren
        _mieter_combo_aktivieren(
            self._feld_mieter, self._verbindung, self
        )
        formular.addRow("Mieter (optional):", self._feld_mieter)

        self._feld_beschreibung = QLineEdit()
        self._feld_beschreibung.setPlaceholderText(
            "frei eintragen — z. B. Mieteinnahme von …, oder etwas Neues"
        )
        formular.addRow("Beschreibung:", self._feld_beschreibung)

        self._beleg_label = QLabel("kein Beleg")
        knopf_beleg = QPushButton("Wählen …")
        knopf_beleg.clicked.connect(self._beleg_waehlen)
        knopf_beleg_weg = QPushButton("Entfernen")
        knopf_beleg_weg.clicked.connect(self._beleg_entfernen)
        beleg_zeile = QHBoxLayout()
        beleg_zeile.addWidget(self._beleg_label, stretch=1)
        beleg_zeile.addWidget(knopf_beleg)
        beleg_zeile.addWidget(knopf_beleg_weg)
        formular.addRow("Beleg:", beleg_zeile)

        # --- Steuerliche Behandlung (optional) ------------------------
        self._feld_anteil = QLineEdit()
        self._feld_anteil.setToolTip(
            "Leer lassen = Voreinstellung von Kategorie bzw. Haus. "
            "Beispiel: 50 für eine Ausgabe, die nur zur Hälfte auf die "
            "Vermietung entfällt."
        )
        formular.addRow("Steuerlicher Anteil (%):", self._feld_anteil)

        self._feld_steuerjahr = QComboBox()
        self._feld_steuerjahr.setToolTip(
            "Nur für regelmäßige Zahlungen kurz vor/nach dem Jahreswechsel "
            "(10-Tage-Regel, § 11 EStG): z. B. Januar-Miete, die am 28.12. "
            "eingeht, gehört steuerlich ins neue Jahr."
        )
        formular.addRow("Steuerjahr:", self._feld_steuerjahr)

        self._hinweis = QLabel("")
        self._hinweis.setWordWrap(True)
        self._hinweis.setStyleSheet("color: #7a5b00; font-size: 8pt;")
        formular.addRow("", self._hinweis)

        layout.addLayout(formular)

        self._steuerjahre_fuellen(None)
        self._feld_datum.dateChanged.connect(
            lambda _d: self._steuerjahre_fuellen(
                self._feld_steuerjahr.currentData()))
        self._feld_kategorie.currentIndexChanged.connect(
            self._kategorie_gewechselt)
        self._feld_haus.currentIndexChanged.connect(
            self._hinweise_aktualisieren)

        if buchung_id is not None:
            self._daten_laden()
        else:
            self._kategorie_gewechselt()

        knoepfe = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        knoepfe.button(QDialogButtonBox.Ok).setText("Speichern")
        knoepfe.button(QDialogButtonBox.Cancel).setText("Abbrechen")
        knoepfe.accepted.connect(self._speichern)
        knoepfe.rejected.connect(self.reject)
        layout.addWidget(knoepfe)

    def _richtung_gewaehlt(self, _index: int) -> None:
        self._richtung_angefasst = True

    def _gewaehlte_kategorie(self) -> dict | None:
        kategorie_id = self._feld_kategorie.currentData()
        if (isinstance(kategorie_id, int)
                and self._feld_kategorie.currentText()
                == self._feld_kategorie.itemText(
                    self._feld_kategorie.currentIndex())):
            return self._kategorie_info.get(kategorie_id)
        return None

    def _kategorie_gewechselt(self, *_args) -> None:
        """Neue Buchung: Zahlungsrichtung passend zur Kategorie vorbelegen."""
        info = self._gewaehlte_kategorie()
        if (info is not None and self._buchung_id is None
                and not self._richtung_angefasst):
            self._feld_richtung.setCurrentIndex(
                self._feld_richtung.findData(
                    1 if info["typ"] == "einnahme" else -1))
        self._hinweise_aktualisieren()

    def _steuerjahre_fuellen(self, auswahl) -> None:
        jahr = self._feld_datum.date().year()
        self._feld_steuerjahr.blockSignals(True)
        self._feld_steuerjahr.clear()
        self._feld_steuerjahr.addItem(
            f"automatisch ({jahr}, Jahr der Zahlung)", None)
        for kandidat in (jahr - 1, jahr + 1):
            self._feld_steuerjahr.addItem(f"{kandidat} (10-Tage-Regel)",
                                          kandidat)
        index = self._feld_steuerjahr.findData(auswahl)
        self._feld_steuerjahr.setCurrentIndex(max(index, 0))
        self._feld_steuerjahr.blockSignals(False)

    def _hinweise_aktualisieren(self, *_args) -> None:
        info = self._gewaehlte_kategorie()
        texte = []
        if info is None:
            self._feld_anteil.setPlaceholderText("Voreinstellung")
            self._hinweis.setText("")
            return
        prozent = info["prozent"]
        haus_id = self._feld_haus.currentData()
        kategorie_id = self._feld_kategorie.currentData()
        if haus_id is not None:
            ausnahme = stammdaten.haus_anteile_laden(
                self._verbindung, kategorie_id).get(haus_id)
            if ausnahme is not None:
                prozent = ausnahme
        self._feld_anteil.setPlaceholderText(
            f"Voreinstellung: {steuer.prozent_formatieren(prozent or 100)}")
        texte.append("Steuerlich: " + steuer.steuer_art_text(info["art"]))
        eingang = self._feld_richtung.currentData() == 1
        if info["typ"] == "ausgabe" and eingang:
            texte.append("Geldeingang auf Ausgabe-Kategorie → wird als "
                         "Erstattung gebucht und mindert diese Kosten.")
        elif info["typ"] == "einnahme" and not eingang:
            texte.append("Geldausgang auf Einnahme-Kategorie → wird als "
                         "Rückzahlung gebucht und mindert diese Einnahmen.")
        self._hinweis.setText("\n".join(texte))

    def _mieter_combo_fuellen(self) -> None:
        """Befüllt die Mieter-Auswahl passend zum gewählten Haus.

        Enthält am Ende einen Sondereintrag „+ Neuen Mieter anlegen …",
        sodass aus der Buchungs-Eingabe heraus direkt ein neuer Mieter
        erfasst werden kann — ohne Umweg über die Stammdaten.
        """
        from src.ui.import_seite import _mieter_combo_fuellen
        _mieter_combo_fuellen(
            self._feld_mieter, self._verbindung,
            self._feld_haus.currentData(),
        )

    def _daten_laden(self) -> None:
        """Füllt das Formular mit den Werten einer bestehenden Buchung."""
        zeile = self._verbindung.execute(
            "SELECT b.datum, b.betrag, b.objekt_id, b.kategorie_id, "
            "b.mieter_id, b.beschreibung, b.beleg_pfad, b.steuer_prozent, "
            "b.steuerjahr, k.typ FROM buchungen b "
            "LEFT JOIN kategorien k ON k.id = b.kategorie_id WHERE b.id = ?",
            (self._buchung_id,),
        ).fetchone()
        if zeile is None:
            return
        if zeile["datum"]:
            self._feld_datum.setDate(
                QDate.fromString(zeile["datum"], "yyyy-MM-dd")
            )
        kasse = steuer.kassenbetrag(Decimal(zeile["betrag"]), zeile["typ"])
        self._feld_betrag.setText(betrag_formatieren(abs(kasse)))
        self._feld_richtung.setCurrentIndex(
            self._feld_richtung.findData(1 if kasse > 0 else -1))
        self._feld_anteil.setText(
            steuer.prozent_formatieren(steuer.dezimal(zeile["steuer_prozent"]))
            .replace(" %", ""))
        self._steuerjahre_fuellen(zeile["steuerjahr"])
        index_haus = self._feld_haus.findData(zeile["objekt_id"])
        if index_haus >= 0:
            self._feld_haus.setCurrentIndex(index_haus)
        index_kat = self._feld_kategorie.findData(zeile["kategorie_id"])
        if index_kat >= 0:
            self._feld_kategorie.setCurrentIndex(index_kat)
        # Haus-Wechsel hat das Mieter-Combo aktualisiert — jetzt Auswahl setzen.
        self._mieter_combo_fuellen()
        index_mieter = self._feld_mieter.findData(zeile["mieter_id"])
        if index_mieter >= 0:
            self._feld_mieter.setCurrentIndex(index_mieter)
        self._feld_beschreibung.setText(zeile["beschreibung"] or "")
        self._beleg_bestehend = zeile["beleg_pfad"]
        self._beleg_label_aktualisieren()

    def _beleg_waehlen(self) -> None:
        pfad, _ = QFileDialog.getOpenFileName(self, "Beleg auswählen")
        if pfad:
            self._beleg_neu = pfad
            self._beleg_label_aktualisieren()

    def _beleg_entfernen(self) -> None:
        self._beleg_neu = None
        self._beleg_bestehend = None
        self._beleg_label_aktualisieren()

    def _beleg_label_aktualisieren(self) -> None:
        if self._beleg_neu:
            self._beleg_label.setText(Path(self._beleg_neu).name + "  (neu)")
        elif self._beleg_bestehend:
            self._beleg_label.setText(Path(self._beleg_bestehend).name)
        else:
            self._beleg_label.setText("kein Beleg")

    def _speichern(self) -> None:
        """Validiert die Eingaben und schreibt die Buchung in die Datenbank."""
        try:
            betrag = betrag_parsen(self._feld_betrag.text())
            anteil = steuer.prozent_parsen(self._feld_anteil.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        if betrag == 0:
            QMessageBox.warning(self, "Eingabe ungültig",
                                "Der Betrag darf nicht 0 sein.")
            return

        from src.ui.import_seite import _kategorie_aus_combo
        objekt_id = self._feld_haus.currentData()
        try:
            kategorie_id = _kategorie_aus_combo(
                self._verbindung, self._feld_kategorie
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.warning(self, "Kategorie ungültig", str(fehler))
            return
        if objekt_id is None or kategorie_id is None:
            QMessageBox.warning(
                self, "Auswahl fehlt",
                "Bitte Haus wählen und eine Kategorie wählen oder neu "
                "eintippen."
            )
            return

        datum = self._feld_datum.date().toString("yyyy-MM-dd")
        jahr = self._feld_datum.date().year()

        beleg_pfad = self._beleg_bestehend
        if self._beleg_neu:
            try:
                beleg_pfad = beleg_archivieren(self._beleg_neu, jahr)
            except (OSError, FileNotFoundError) as fehler:
                QMessageBox.critical(
                    self, "Beleg konnte nicht archiviert werden", str(fehler)
                )
                return

        mieter_id = self._feld_mieter.currentData()
        typ = self._verbindung.execute(
            "SELECT typ FROM kategorien WHERE id = ?", (kategorie_id,)
        ).fetchone()["typ"]
        gespeichert = steuer.betrag_fuer_kategorie(
            betrag * self._feld_richtung.currentData(), typ
        )
        steuerjahr = self._feld_steuerjahr.currentData()
        try:
            if self._buchung_id is None:
                buchungen.buchung_anlegen(
                    self._verbindung, datum, gespeichert, objekt_id,
                    kategorie_id, self._feld_beschreibung.text().strip(),
                    beleg_pfad, "manuell", mieter_id=mieter_id,
                    steuer_prozent=anteil, steuerjahr=steuerjahr,
                )
            else:
                buchungen.buchung_felder_setzen(
                    self._verbindung, self._buchung_id, datum=datum,
                    betrag=str(gespeichert), objekt_id=objekt_id,
                    kategorie_id=kategorie_id, mieter_id=mieter_id,
                    beschreibung=self._feld_beschreibung.text().strip(),
                    beleg_pfad=beleg_pfad,
                    steuer_prozent=None if anteil is None else str(anteil),
                    steuerjahr=steuerjahr,
                )
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return

        self.accept()


class BuchungenSeite(QWidget):
    """Buchungsübersicht mit Filtern und Bearbeitungsfunktionen."""

    def __init__(self, verbindung: sqlite3.Connection, parent=None) -> None:
        super().__init__(parent)
        self._verbindung = verbindung

        layout = QVBoxLayout(self)

        # Suchzeile
        suchzeile = QHBoxLayout()
        suchzeile.addWidget(QLabel("Suche:"))
        self._suche = QLineEdit()
        self._suche.setPlaceholderText(
            "Beschreibung, Haus, Kategorie oder Mietername — frei tippen"
        )
        self._suche.textChanged.connect(self._tabelle_laden)
        suchzeile.addWidget(self._suche, stretch=1)
        layout.addLayout(suchzeile)

        # Filterzeile
        filterzeile = QHBoxLayout()
        self._filter_haus = QComboBox()
        self._filter_kategorie = QComboBox()
        self._filter_monat = QComboBox()
        self._filter_jahr = QComboBox()
        self._filter_beleg = QComboBox()
        self._filter_beleg.addItem("Alle", None)
        self._filter_beleg.addItem("mit Beleg", True)
        self._filter_beleg.addItem("ohne Beleg", False)
        for beschriftung, combo in (
            ("Haus:", self._filter_haus),
            ("Kategorie:", self._filter_kategorie),
            ("Monat:", self._filter_monat),
            ("Jahr:", self._filter_jahr),
            ("Beleg:", self._filter_beleg),
        ):
            filterzeile.addWidget(QLabel(beschriftung))
            filterzeile.addWidget(combo)
            combo.currentIndexChanged.connect(self._tabelle_laden)
        filterzeile.addStretch()
        layout.addLayout(filterzeile)

        # Schnell-Eingabe (über der Tabelle, ohne Dialog)
        schnellzeile = QHBoxLayout()
        schnellzeile.addWidget(QLabel("Schnell-Eingabe:"))
        self._schnell_datum = QDateEdit()
        self._schnell_datum.setCalendarPopup(True)
        self._schnell_datum.setDisplayFormat("dd.MM.yyyy")
        self._schnell_datum.setDate(QDate.currentDate())
        schnellzeile.addWidget(self._schnell_datum)
        self._schnell_betrag = QLineEdit()
        self._schnell_betrag.setPlaceholderText("Betrag, z. B. 85,40")
        self._schnell_betrag.setFixedWidth(120)
        schnellzeile.addWidget(self._schnell_betrag)
        self._schnell_haus = QComboBox()
        for haus in stammdaten.objekte_laden(self._verbindung):
            self._schnell_haus.addItem(haus["name"], haus["id"])
        schnellzeile.addWidget(self._schnell_haus)
        self._schnell_kategorie = QComboBox()
        self._schnell_kategorie.setEditable(True)
        self._schnell_kategorie.setInsertPolicy(QComboBox.NoInsert)
        self._schnell_kategorie.setProperty("kategorie_typ", "ausgabe")
        self._schnell_kategorie.setToolTip(
            "Neue Kategorie einfach eintippen — mit „(Einnahme)“ am Ende "
            "wird sie als Einnahme angelegt."
        )
        for typ, label in (("einnahme", "Einnahme"), ("ausgabe", "Ausgabe")):
            for kat in stammdaten.kategorien_laden(self._verbindung, typ):
                self._schnell_kategorie.addItem(
                    f"{kat['name']} ({label})", kat["id"]
                )
        schnellzeile.addWidget(self._schnell_kategorie)
        self._schnell_text = QLineEdit()
        self._schnell_text.setPlaceholderText("Beschreibung")
        schnellzeile.addWidget(self._schnell_text, stretch=1)
        knopf_schnell = QPushButton("Hinzufügen")
        knopf_schnell.clicked.connect(self._schnell_anlegen)
        self._schnell_text.returnPressed.connect(self._schnell_anlegen)
        self._schnell_betrag.returnPressed.connect(self._schnell_anlegen)
        schnellzeile.addWidget(knopf_schnell)
        layout.addLayout(schnellzeile)

        # Tabelle
        self._tabelle = QTableWidget(0, 9)
        self._tabelle.setHorizontalHeaderLabels(
            ["Datum", "Betrag", "Haus", "Kategorie", "Mieter",
             "Beschreibung", "Beleg", "Quelle", "Steuer"]
        )
        tabelle_vorbereiten(self._tabelle)
        # Mehrfach-Auswahl für die Sammel-Bearbeitung (Strg/Shift-Klick).
        from PySide6.QtWidgets import QAbstractItemView
        self._tabelle.setSelectionMode(QAbstractItemView.ExtendedSelection)
        layout.addWidget(self._tabelle)

        # Knöpfe
        knopfleiste = QHBoxLayout()
        for beschriftung, methode in (
            ("Neue Buchung", self._neue_buchung),
            ("Bearbeiten", self._buchung_bearbeiten),
            ("Sammel-Bearbeiten …", self._sammel_bearbeiten),
            ("Löschen", self._buchung_loeschen),
            ("Beleg öffnen", self._beleg_oeffnen),
        ):
            knopf = QPushButton(beschriftung)
            knopf.clicked.connect(methode)
            knopfleiste.addWidget(knopf)
        knopfleiste.addStretch()
        layout.addLayout(knopfleiste)

        # Tastaturkürzel
        from PySide6.QtGui import QShortcut, QKeySequence
        QShortcut(QKeySequence("Ctrl+N"), self, self._neue_buchung)
        QShortcut(QKeySequence("Ctrl+F"), self, lambda: self._suche.setFocus())
        QShortcut(QKeySequence(Qt.Key_Delete), self, self._buchung_loeschen)
        QShortcut(QKeySequence("Ctrl+Return"), self, self._schnell_anlegen)
        self._tabelle.itemDoubleClicked.connect(
            lambda *_: self._buchung_bearbeiten()
        )

        self.aktualisieren()

    def aktualisieren(self) -> None:
        """Lädt Filter-Auswahllisten und Tabelle neu."""
        self._filter_neu_aufbauen()
        self._tabelle_laden()

    def _schnell_anlegen(self) -> None:
        """Legt eine Buchung aus der Inline-Eingabezeile an."""
        if not self._schnell_betrag.text().strip():
            return
        try:
            betrag = betrag_parsen(self._schnell_betrag.text())
        except ValidierungsFehler as fehler:
            QMessageBox.warning(self, "Eingabe ungültig", str(fehler))
            return
        from src.ui.import_seite import _kategorie_aus_combo
        objekt_id = self._schnell_haus.currentData()
        try:
            kategorie_id = _kategorie_aus_combo(
                self._verbindung, self._schnell_kategorie
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.warning(self, "Kategorie ungültig", str(fehler))
            return
        if objekt_id is None or kategorie_id is None:
            QMessageBox.warning(
                self, "Auswahl fehlt",
                "Haus wählen und Kategorie wählen oder neu eintippen."
            )
            return
        datum = self._schnell_datum.date().toString("yyyy-MM-dd")
        try:
            buchungen.buchung_anlegen(
                self._verbindung, datum, betrag, objekt_id, kategorie_id,
                self._schnell_text.text().strip(), None, "manuell",
            )
        except (ValidierungsFehler, sqlite3.Error) as fehler:
            QMessageBox.warning(self, "Fehler", str(fehler))
            return
        self._schnell_betrag.clear()
        self._schnell_text.clear()
        self._tabelle_laden()

    def _filter_neu_aufbauen(self) -> None:
        """Baut die Filter-Combos neu auf und behält die Auswahl bei."""
        for combo in (self._filter_haus, self._filter_kategorie,
                       self._filter_monat, self._filter_jahr):
            combo.blockSignals(True)

        haus_alt = self._filter_haus.currentData()
        self._filter_haus.clear()
        self._filter_haus.addItem("Alle Häuser", None)
        for haus in stammdaten.objekte_laden(self._verbindung):
            self._filter_haus.addItem(haus["name"], haus["id"])
        self._filter_haus.setCurrentIndex(
            max(self._filter_haus.findData(haus_alt), 0)
        )

        kat_alt = self._filter_kategorie.currentData()
        self._filter_kategorie.clear()
        self._filter_kategorie.addItem("Alle Kategorien", None)
        for typ in ("einnahme", "ausgabe"):
            for kategorie in stammdaten.kategorien_laden(self._verbindung, typ):
                self._filter_kategorie.addItem(kategorie["name"], kategorie["id"])
        self._filter_kategorie.setCurrentIndex(
            max(self._filter_kategorie.findData(kat_alt), 0)
        )

        monat_alt = self._filter_monat.currentData()
        self._filter_monat.clear()
        self._filter_monat.addItem("Alle Monate", None)
        for nummer, name in enumerate(MONATSNAMEN, start=1):
            self._filter_monat.addItem(name, nummer)
        self._filter_monat.setCurrentIndex(
            max(self._filter_monat.findData(monat_alt), 0)
        )

        jahr_alt = self._filter_jahr.currentData()
        self._filter_jahr.clear()
        self._filter_jahr.addItem("Alle Jahre", None)
        for jahr in buchungen.auswaehlbare_jahre(self._verbindung):
            self._filter_jahr.addItem(str(jahr), jahr)
        self._filter_jahr.setCurrentIndex(
            max(self._filter_jahr.findData(jahr_alt), 0)
        )

        for combo in (self._filter_haus, self._filter_kategorie,
                       self._filter_monat, self._filter_jahr):
            combo.blockSignals(False)

    def _tabelle_laden(self) -> None:
        """Füllt die Buchungstabelle nach den aktuellen Filtern."""
        zeilen = buchungen.buchungen_laden(
            self._verbindung,
            objekt_id=self._filter_haus.currentData(),
            kategorie_id=self._filter_kategorie.currentData(),
            monat=self._filter_monat.currentData(),
            jahr=self._filter_jahr.currentData(),
            beleg=self._filter_beleg.currentData(),
            suchtext=self._suche.text() if self._suche.text() else None,
        )
        self._tabelle.setSortingEnabled(False)
        self._tabelle.setRowCount(len(zeilen))
        for index, zeile in enumerate(zeilen):
            datum_item = SortierItem(
                datum_anzeigen(zeile["datum"]), zeile["datum"] or ""
            )
            datum_item.setData(Qt.UserRole, zeile["id"])
            datum_item.setData(Qt.UserRole + 1, zeile["beleg_pfad"])

            betrag = Decimal(zeile["betrag"])
            if zeile["kategorie_typ"] == "ausgabe":
                betrag = -betrag
            betrag_item = SortierItem(
                f"{betrag_formatieren(betrag)} €", betrag
            )

            beleg = zeile["beleg_pfad"]
            beleg_text = Path(beleg).name if beleg else "—"
            quelle = zeile["quelle"] or "manuell"
            quelle_text = "Mietzahlung" if quelle.startswith("mietzahlung") \
                else quelle

            steuer_teile = []
            if zeile["steuer_prozent"] not in (None, ""):
                steuer_teile.append(steuer.prozent_formatieren(
                    steuer.dezimal(zeile["steuer_prozent"])))
            if zeile["steuerjahr"] is not None:
                steuer_teile.append(f"→ {zeile['steuerjahr']}")

            werte = [
                datum_item,
                betrag_item,
                QTableWidgetItem(zeile["objekt_name"] or "—"),
                QTableWidgetItem(zeile["kategorie_name"] or "—"),
                QTableWidgetItem(zeile["mieter_name"] or "—"),
                QTableWidgetItem(zeile["beschreibung"] or ""),
                QTableWidgetItem(beleg_text),
                QTableWidgetItem(quelle_text),
                QTableWidgetItem(" · ".join(steuer_teile)),
            ]
            for spalte, item in enumerate(werte):
                self._tabelle.setItem(index, spalte, item)
        self._tabelle.setSortingEnabled(True)

    def _ausgewaehlte_buchung(self) -> int | None:
        """Liefert die ID der markierten Buchung oder None."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            return None
        return self._tabelle.item(zeile, 0).data(Qt.UserRole)

    def _ausgewaehlte_buchungen(self) -> list[int]:
        """Liefert die IDs aller markierten Buchungen (Mehrfach-Auswahl)."""
        zeilen = sorted({idx.row() for idx in self._tabelle.selectedIndexes()})
        ids = []
        for zeile in zeilen:
            item = self._tabelle.item(zeile, 0)
            if item is not None:
                ids.append(item.data(Qt.UserRole))
        return ids

    def _sammel_bearbeiten(self) -> None:
        """Setzt Haus, Kategorie und/oder Mieter für alle markierten Buchungen.

        Felder, die im Dialog auf „nicht ändern" stehen, behalten je
        Buchung ihren bisherigen Wert. Jede Änderung wird im Aktions-Log
        protokolliert und ist einzeln rückgängig machbar.
        """
        from src.ui.import_seite import SammelZuordnungDialog
        ids = self._ausgewaehlte_buchungen()
        if len(ids) < 1:
            QMessageBox.information(
                self, "Nichts markiert",
                "Bitte zuerst eine oder mehrere Buchungen markieren "
                "(Strg/Shift-Klick für mehrere)."
            )
            return
        dialog = SammelZuordnungDialog(self._verbindung, parent=self)
        if dialog.exec() != QDialog.Accepted:
            return
        auswahl = dialog.auswahl()
        if all(wert == "__keep__" for wert in auswahl.values()):
            return
        try:
            for buchung_id in ids:
                zeile = self._verbindung.execute(
                    "SELECT objekt_id, kategorie_id, mieter_id "
                    "FROM buchungen WHERE id = ?", (buchung_id,)
                ).fetchone()
                if zeile is None:
                    continue
                objekt_id = zeile["objekt_id"] \
                    if auswahl["objekt_id"] == "__keep__" \
                    else auswahl["objekt_id"]
                kategorie_id = zeile["kategorie_id"] \
                    if auswahl["kategorie_id"] == "__keep__" \
                    else auswahl["kategorie_id"]
                mieter_id = zeile["mieter_id"] \
                    if auswahl["mieter_id"] == "__keep__" \
                    else auswahl["mieter_id"]
                buchungen.zuordnung_setzen(
                    self._verbindung, buchung_id,
                    objekt_id, kategorie_id, mieter_id,
                )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        QMessageBox.information(
            self, "Sammel-Bearbeitung",
            f"{len(ids)} Buchung(en) wurden angepasst."
        )
        self.aktualisieren()

    def _neue_buchung(self) -> None:
        dialog = BuchungDialog(self._verbindung, parent=self)
        if dialog.exec() == QDialog.Accepted:
            self.aktualisieren()

    def _buchung_bearbeiten(self) -> None:
        buchung_id = self._ausgewaehlte_buchung()
        if buchung_id is None:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        vorher = self._verbindung.execute(
            "SELECT objekt_id, kategorie_id, mieter_id, beschreibung "
            "FROM buchungen WHERE id = ?", (buchung_id,)
        ).fetchone()
        dialog = BuchungDialog(self._verbindung, buchung_id, parent=self)
        if dialog.exec() == QDialog.Accepted:
            if vorher is not None:
                self._umlernen_anbieten(buchung_id, vorher)
            self.aktualisieren()

    def _umlernen_anbieten(self, buchung_id: int, vorher) -> None:
        """Überträgt eine korrigierte Zuordnung auf ähnliche Buchungen.

        Wurde Haus, Kategorie oder Mieter geändert, lernt die App die
        Korrektur (Muster wird aktualisiert) und bietet an, ähnliche
        ältere Buchungen desselben Empfängers ebenfalls anzupassen.
        """
        from src.db import muster
        from src.logic import lernsystem

        nachher = self._verbindung.execute(
            "SELECT objekt_id, kategorie_id, mieter_id, beschreibung "
            "FROM buchungen WHERE id = ?", (buchung_id,)
        ).fetchone()
        if nachher is None:
            return
        unveraendert = all(
            vorher[feld] == nachher[feld]
            for feld in ("objekt_id", "kategorie_id", "mieter_id")
        )
        if unveraendert:
            return

        beschreibung = nachher["beschreibung"] or ""
        erkennung = lernsystem.erkennungstext_bilden(
            lernsystem.normalisieren(beschreibung)
        )
        if erkennung:
            # Muster auf die korrigierte Zuordnung umlernen.
            muster.muster_speichern(
                self._verbindung, erkennung,
                nachher["objekt_id"], nachher["kategorie_id"],
                mieter_id=nachher["mieter_id"],
            )

        # Ähnliche Buchungen mit abweichender Zuordnung suchen.
        aehnlich = [
            bid for bid in lernsystem.aehnliche_buchungen(
                self._verbindung, beschreibung, ausser_id=buchung_id
            )
            if self._verbindung.execute(
                "SELECT 1 FROM buchungen WHERE id = ? AND ("
                "IFNULL(objekt_id, -1) != IFNULL(?, -1) OR "
                "IFNULL(kategorie_id, -1) != IFNULL(?, -1) OR "
                "IFNULL(mieter_id, -1) != IFNULL(?, -1))",
                (bid, nachher["objekt_id"], nachher["kategorie_id"],
                 nachher["mieter_id"]),
            ).fetchone() is not None
        ]
        if not aehnlich:
            return
        antwort = QMessageBox.question(
            self, "Ähnliche Buchungen anpassen?",
            f"Die Zuordnung wurde geändert. Es gibt {len(aehnlich)} "
            "weitere Buchung(en) desselben Empfängers mit der alten "
            "Zuordnung.\n\nSollen diese ebenfalls angepasst werden?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            for bid in aehnlich:
                buchungen.zuordnung_setzen(
                    self._verbindung, bid,
                    nachher["objekt_id"], nachher["kategorie_id"],
                    nachher["mieter_id"],
                )
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        QMessageBox.information(
            self, "Umgelernt",
            f"{len(aehnlich)} Buchung(en) wurden angepasst. Die App "
            "verwendet die neue Zuordnung auch für künftige Importe."
        )

    def _buchung_loeschen(self) -> None:
        buchung_id = self._ausgewaehlte_buchung()
        if buchung_id is None:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        antwort = QMessageBox.question(
            self, "Buchung löschen",
            "Die markierte Buchung wirklich löschen?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if antwort != QMessageBox.Yes:
            return
        try:
            buchungen.buchung_loeschen(self._verbindung, buchung_id)
        except sqlite3.Error as fehler:
            QMessageBox.critical(self, "Datenbankfehler", str(fehler))
            return
        self.aktualisieren()

    def _beleg_oeffnen(self) -> None:
        """Öffnet den Beleg der markierten Buchung im Standardprogramm."""
        zeile = self._tabelle.currentRow()
        if zeile < 0:
            QMessageBox.information(self, "Keine Buchung gewählt",
                                    "Bitte zuerst eine Buchung auswählen.")
            return
        beleg = self._tabelle.item(zeile, 0).data(Qt.UserRole + 1)
        if not beleg:
            QMessageBox.information(
                self, "Kein Beleg",
                "Zu dieser Buchung ist kein Beleg hinterlegt."
            )
            return
        pfad = beleg_absolut(beleg)
        if not pfad.is_file():
            QMessageBox.warning(
                self, "Beleg nicht gefunden",
                f"Die Belegdatei wurde nicht gefunden:\n{pfad}"
            )
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(pfad)))
