"""Nebenkostenabrechnung: Berechnung und Export (Excel + PDF).

Je Haus werden die als umlagefähig markierten Ausgaben eines Jahres
zusammengezählt und nach dem Umlageschlüssel des Hauses auf die Mieter
verteilt. Aus den geleisteten Vorauszahlungen ergibt sich je Mieter
eine Nachzahlung oder ein Guthaben.

Vereinfachungen (bewusst, für die private Nutzung):
* Abrechnungszeitraum ist stets das Kalenderjahr.
* Mieter, deren Mietzeitraum das Jahr berührt, werden voll einbezogen;
  taggenaue Anteile bei unterjährigem Ein-/Auszug werden nicht gebildet.
* Heizkosten werden wie alle übrigen umlagefähigen Kosten verteilt.
"""

from __future__ import annotations

import html
import sqlite3
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font

from src.db.mietzahlungen import bezahlte_monate
from src.db.stammdaten import UMLAGESCHLUESSEL, objekte_laden
from src.utils.eingaben import ValidierungsFehler, betrag_formatieren
from src.utils.paths import exporte_verzeichnis

_CENT = Decimal("0.01")
_WAEHRUNG = '#,##0.00 "€"'


def _aktiv_im_jahr(
    aktiv_von: str | None, aktiv_bis: str | None, jahr: int
) -> bool:
    """Prüft, ob ein Mietzeitraum das angegebene Jahr berührt."""
    if aktiv_von:
        try:
            if int(aktiv_von[:4]) > jahr:
                return False
        except ValueError:
            pass
    if aktiv_bis:
        try:
            if int(aktiv_bis[:4]) < jahr:
                return False
        except ValueError:
            pass
    return True


def _umlagefaehige_kosten(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> list[tuple[str, Decimal]]:
    """Liefert die umlagefähigen Ausgaben eines Hauses je Kategorie."""
    zeilen = verbindung.execute(
        "SELECT k.name AS name, b.betrag AS betrag "
        "FROM buchungen b JOIN kategorien k ON k.id = b.kategorie_id "
        "WHERE b.objekt_id = ? AND substr(b.datum, 1, 4) = ? "
        "AND k.typ = 'ausgabe' AND k.umlagefaehig = 1",
        (objekt_id, f"{jahr:04d}"),
    ).fetchall()
    summen: dict[str, Decimal] = {}
    for zeile in zeilen:
        try:
            betrag = Decimal(zeile["betrag"])
        except (ValueError, TypeError):
            continue
        summen[zeile["name"]] = summen.get(zeile["name"], Decimal("0")) + betrag
    return sorted(summen.items())


def abrechnung_erstellen(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> dict:
    """Berechnet die Nebenkostenabrechnung eines Hauses für ein Jahr."""
    haus = verbindung.execute(
        "SELECT name, umlageschluessel FROM objekte WHERE id = ?",
        (objekt_id,),
    ).fetchone()
    if haus is None:
        raise ValidierungsFehler("Das Haus wurde nicht gefunden.")
    schluessel = haus["umlageschluessel"]

    kosten = _umlagefaehige_kosten(verbindung, objekt_id, jahr)
    kosten_gesamt = sum((betrag for _, betrag in kosten), Decimal("0"))

    alle_mieter = verbindung.execute(
        "SELECT id, name, nebenkosten, aktiv_von, aktiv_bis, wohnflaeche, "
        "personenzahl FROM mieter WHERE objekt_id = ? "
        "ORDER BY name COLLATE NOCASE",
        (objekt_id,),
    ).fetchall()
    mieter = [
        m for m in alle_mieter
        if _aktiv_im_jahr(m["aktiv_von"], m["aktiv_bis"], jahr)
    ]

    def schluesselwert(zeile: sqlite3.Row) -> Decimal:
        if schluessel == "personen":
            return Decimal(zeile["personenzahl"])
        if schluessel == "gleich":
            return Decimal("1")
        try:
            return Decimal(str(zeile["wohnflaeche"]))
        except (ValueError, TypeError):
            return Decimal("0")

    summe_schluessel = sum(
        (schluesselwert(m) for m in mieter), Decimal("0")
    )

    mieter_ergebnis = []
    for m in mieter:
        wert = schluesselwert(m)
        anteil = (wert / summe_schluessel) if summe_schluessel > 0 \
            else Decimal("0")
        kostenanteil = (kosten_gesamt * anteil).quantize(_CENT)
        monate = len(bezahlte_monate(verbindung, m["id"], jahr))
        try:
            monatlich = Decimal(str(m["nebenkosten"]))
        except (ValueError, TypeError):
            monatlich = Decimal("0")
        vorauszahlung = (monatlich * monate).quantize(_CENT)
        mieter_ergebnis.append({
            "name": m["name"],
            "schluesselwert": wert,
            "anteil": anteil,
            "kostenanteil": kostenanteil,
            "monate": monate,
            "vorauszahlung": vorauszahlung,
            "differenz": vorauszahlung - kostenanteil,
        })

    return {
        "haus": haus["name"],
        "jahr": jahr,
        "umlageschluessel": schluessel,
        "kosten": kosten,
        "kosten_gesamt": kosten_gesamt,
        "mieter": mieter_ergebnis,
    }


def abrechnung_excel(verbindung: sqlite3.Connection, jahr: int) -> Path:
    """Erstellt eine Excel-Datei mit der Nebenkostenabrechnung aller Häuser."""
    arbeitsmappe = Workbook()
    blatt = arbeitsmappe.active
    blatt.title = f"Nebenkosten {jahr}"
    fett = Font(bold=True)

    blatt.column_dimensions["A"].width = 28
    for spalte in ("B", "C", "D", "E"):
        blatt.column_dimensions[spalte].width = 16

    zeile = 1
    titel = blatt.cell(zeile, 1, f"Nebenkostenabrechnung {jahr}")
    titel.font = Font(bold=True, size=14)
    zeile += 2

    for haus in objekte_laden(verbindung):
        abrechnung = abrechnung_erstellen(verbindung, haus["id"], jahr)
        kopf = blatt.cell(
            zeile, 1,
            f"{abrechnung['haus']} "
            f"({UMLAGESCHLUESSEL[abrechnung['umlageschluessel']]})",
        )
        kopf.font = Font(bold=True, size=12)
        zeile += 1

        blatt.cell(zeile, 1, "Umlagefähige Kosten").font = fett
        zeile += 1
        for name, betrag in abrechnung["kosten"]:
            blatt.cell(zeile, 1, name)
            zelle = blatt.cell(zeile, 2, float(betrag))
            zelle.number_format = _WAEHRUNG
            zeile += 1
        blatt.cell(zeile, 1, "Summe").font = fett
        summe = blatt.cell(zeile, 2, float(abrechnung["kosten_gesamt"]))
        summe.number_format = _WAEHRUNG
        summe.font = fett
        zeile += 2

        for index, titeltext in enumerate(
            ("Mieter", "Anteil", "Kostenanteil", "Vorauszahlung", "Differenz")
        ):
            blatt.cell(zeile, 1 + index, titeltext).font = fett
        zeile += 1
        for eintrag in abrechnung["mieter"]:
            blatt.cell(zeile, 1, eintrag["name"])
            blatt.cell(zeile, 2, f"{eintrag['anteil'] * 100:.1f} %")
            for spalte, schluessel in (
                (3, "kostenanteil"), (4, "vorauszahlung"), (5, "differenz")
            ):
                zelle = blatt.cell(zeile, spalte, float(eintrag[schluessel]))
                zelle.number_format = _WAEHRUNG
            zeile += 1
        zeile += 2

    ziel = exporte_verzeichnis() / f"Nebenkosten_{jahr}.xlsx"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    arbeitsmappe.save(ziel)
    return ziel


def abrechnung_html(abrechnung: dict, eintrag: dict) -> str:
    """Erzeugt den HTML-Inhalt der Abrechnung für einen einzelnen Mieter."""
    schluessel_text = UMLAGESCHLUESSEL[abrechnung["umlageschluessel"]]
    kosten_zeilen = "".join(
        f"<tr><td>{html.escape(name)}</td>"
        f"<td align='right'>{betrag_formatieren(betrag)} €</td></tr>"
        for name, betrag in abrechnung["kosten"]
    )
    differenz = eintrag["differenz"]
    if differenz >= 0:
        fazit = (f"Guthaben — Rückzahlung an den Mieter: "
                 f"{betrag_formatieren(differenz)} €")
    else:
        fazit = (f"Nachzahlung durch den Mieter: "
                 f"{betrag_formatieren(-differenz)} €")

    return f"""
    <h2>Nebenkostenabrechnung {abrechnung['jahr']}</h2>
    <p>
      <b>Haus:</b> {html.escape(abrechnung['haus'])}<br>
      <b>Mieter:</b> {html.escape(eintrag['name'])}<br>
      <b>Abrechnungszeitraum:</b>
      01.01.{abrechnung['jahr']} – 31.12.{abrechnung['jahr']}<br>
      <b>Umlageschlüssel:</b> {schluessel_text}
    </p>
    <h3>Umlagefähige Gesamtkosten des Hauses</h3>
    <table border='1' cellspacing='0' cellpadding='5' width='100%'>
      {kosten_zeilen}
      <tr><td><b>Summe</b></td><td align='right'><b>
      {betrag_formatieren(abrechnung['kosten_gesamt'])} €</b></td></tr>
    </table>
    <h3>Ihr Anteil</h3>
    <table border='1' cellspacing='0' cellpadding='5' width='100%'>
      <tr><td>Anteil ({schluessel_text})</td>
        <td align='right'>{eintrag['anteil'] * 100:.1f} %</td></tr>
      <tr><td>Ihr Kostenanteil</td>
        <td align='right'>{betrag_formatieren(eintrag['kostenanteil'])} €</td></tr>
      <tr><td>Geleistete Vorauszahlung ({eintrag['monate']} Monate)</td>
        <td align='right'>
        {betrag_formatieren(eintrag['vorauszahlung'])} €</td></tr>
    </table>
    <h3>{fazit}</h3>
    <p><i>Hinweis: Diese Abrechnung wurde automatisch erstellt und ist
    vor Weitergabe zu prüfen.</i></p>
    """


def html_nach_pdf(inhalt_html: str, ziel_pfad: Path) -> None:
    """Schreibt einen HTML-Inhalt als PDF-Datei (über Qt, ohne Zusatzpaket)."""
    from PySide6.QtGui import QPageSize, QPdfWriter, QTextDocument

    schreiber = QPdfWriter(str(ziel_pfad))
    schreiber.setPageSize(QPageSize(QPageSize.A4))
    dokument = QTextDocument()
    dokument.setHtml(inhalt_html)
    dokument.print_(schreiber)


def _dateiname_saeubern(text: str) -> str:
    """Entfernt für Dateinamen ungeeignete Zeichen."""
    erlaubt = [z if z.isalnum() or z in " -_" else "_" for z in text]
    return "".join(erlaubt).strip().replace(" ", "_")


def abrechnung_pdfs(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> list[Path]:
    """Erstellt je Mieter eines Hauses eine PDF-Abrechnung."""
    abrechnung = abrechnung_erstellen(verbindung, objekt_id, jahr)
    ordner = exporte_verzeichnis()
    ordner.mkdir(parents=True, exist_ok=True)

    erstellt: list[Path] = []
    haus_kurz = _dateiname_saeubern(abrechnung["haus"])
    for eintrag in abrechnung["mieter"]:
        mieter_kurz = _dateiname_saeubern(eintrag["name"])
        ziel = ordner / f"Nebenkosten_{haus_kurz}_{mieter_kurz}_{jahr}.pdf"
        html_nach_pdf(abrechnung_html(abrechnung, eintrag), ziel)
        erstellt.append(ziel)
    return erstellt
