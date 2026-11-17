"""Steuer-Exporte für Anlage V und Steuerberater.

* ``anlage_v_excel``: Arbeitsmappe mit Übersicht aller Häuser, je Haus
  ein Blatt mit den Anlage-V-Positionen (Zeilennummer, Gesamtbetrag,
  anzusetzender Betrag), Einzelnachweis aller Buchungen mit
  Belegverweis, nicht berücksichtigten Zahlungen, AfA/Investitionen und
  dem Prüfbericht.
* ``steuerbericht_pdfs``: je Haus ein PDF für den Steuerberater.
* ``belege_sammeln``: kopiert alle Belege des Jahres, benannt nach
  Belegnummer, in einen Ordner.
* ``steuerpaket_erstellen``: alles zusammen in einem Ordner + ZIP.

Alle Beträge cent-genau aus ``src.logic.steuer``.
"""

from __future__ import annotations

import html
import re
import shutil
import sqlite3
import zipfile
from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from src.logic import steuer
from src.logic.belege import beleg_absolut
from src.utils.eingaben import betrag_formatieren, datum_anzeigen
from src.utils.paths import exporte_verzeichnis

_WAEHRUNG = '#,##0.00 "€";[Red]-#,##0.00 "€"'
_FETT = Font(bold=True)
_KOPF_FUELLUNG = PatternFill("solid", fgColor="DDE7F0")
_STUFE_FARBE = {steuer.FEHLER: "F4CCCC", steuer.WARNUNG: "FFF2CC",
                steuer.INFO: "E8EEF7"}


def _dateiname(text: str) -> str:
    text = (text or "").replace("ß", "ss")
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("Ä", "Ae"),
                 ("Ö", "Oe"), ("Ü", "Ue")):
        text = text.replace(a, b)
    return re.sub(r"[^A-Za-z0-9_-]+", "_", text).strip("_")[:40] or "ohne"


def _geld(zelle, wert) -> None:
    zelle.value = float(wert) if wert is not None else None
    zelle.number_format = _WAEHRUNG


def _kopfzeile(blatt, zeile: int, titel: list[str]) -> None:
    for spalte, text in enumerate(titel, start=1):
        zelle = blatt.cell(zeile, spalte, text)
        zelle.font = _FETT
        zelle.fill = _KOPF_FUELLUNG
        zelle.alignment = Alignment(wrap_text=True, vertical="top")


def _breiten(blatt, breiten: list[int]) -> None:
    for index, breite in enumerate(breiten, start=1):
        blatt.column_dimensions[get_column_letter(index)].width = breite


def _art_text(posten: dict) -> str:
    return steuer.steuer_art_text(posten["steuer_art"])


def _position_text(posten: dict) -> str:
    if posten["position"]:
        return steuer.POSITION_NACH_SCHLUESSEL[posten["position"]].bezeichnung
    if posten["ungeklaert"]:
        return "nicht angesetzt – Kategorie ungeklärt"
    return "nicht in Anlage V"


# =========================================================================
# Belege einsammeln
# =========================================================================


def belege_sammeln(
    verbindung: sqlite3.Connection, jahr: int, ziel_ordner: Path
) -> tuple[dict[int, str], list[str]]:
    """Kopiert die Belege aller Buchungen des Jahres nach ``ziel_ordner``.

    Dateiname: ``<Belegnr>_<Datum>_<Kategorie>.<endung>`` je Haus in einem
    Unterordner. Liefert ``({buchung_id: relativer Pfad}, fehlende)``.
    """
    zuordnung: dict[int, str] = {}
    fehlend: list[str] = []
    for p in steuer.posten_laden(verbindung, jahr):
        if not p["beleg_pfad"]:
            continue
        quelle = beleg_absolut(p["beleg_pfad"])
        if not quelle.is_file():
            fehlend.append(f"{p['belegnr']}: {p['beleg_pfad']}")
            continue
        unterordner = _dateiname(p["haus"] or "ohne_Haus")
        name = (f"{p['belegnr']}_{p['datum']}_"
                f"{_dateiname(p['kategorie'] or '')}{quelle.suffix.lower()}")
        ziel = ziel_ordner / unterordner / name
        ziel.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(quelle, ziel)
        zuordnung[p["id"]] = f"{ziel_ordner.name}/{unterordner}/{name}"
    return zuordnung, fehlend


# =========================================================================
# Excel
# =========================================================================


def _blatt_haus(wb, verbindung, daten: dict) -> None:
    blatt = wb.create_sheet(_dateiname(daten["haus"])[:28] or "Haus")
    _breiten(blatt, [9, 58, 18, 18, 18])
    blatt.cell(1, 1, f"Anlage V {daten['jahr']} – {daten['haus']}").font = \
        Font(bold=True, size=14)
    blatt.cell(2, 1, daten["adresse"] or "Adresse nicht hinterlegt")
    blatt.cell(3, 1, f"Zeilennummern: {steuer.ZEILEN_STAND}").font = Font(
        italic=True, color="7F6000")
    _kopfzeile(blatt, 5, ["Zeile", "Position", "Gesamtbetrag",
                          "davon nicht angesetzt", "Anzusetzen (Anlage V)"])
    zeile = 6
    for pos in steuer.POSITIONEN:
        werte = daten["positionen"][pos.schluessel]
        blatt.cell(zeile, 1, steuer.zeilennummer(verbindung, pos.schluessel))
        blatt.cell(zeile, 2, pos.bezeichnung)
        _geld(blatt.cell(zeile, 3), werte["gesamt"])
        _geld(blatt.cell(zeile, 4), werte["gesamt"] - werte["angesetzt"])
        _geld(blatt.cell(zeile, 5), werte["angesetzt"])
        if pos.gruppe == "summe":
            for spalte in range(1, 6):
                blatt.cell(zeile, spalte).font = _FETT
        zeile += 1

    zeile += 1
    blatt.cell(zeile, 1, "AfA").font = _FETT
    zeile += 1
    afa = daten["afa_gebaeude"]
    if afa:
        blatt.cell(zeile, 2, (
            f"Gebäude: Bemessungsgrundlage {betrag_formatieren(afa['bemessung'])}"
            f" €, Beginn {datum_anzeigen(afa['beginn'])}, Satz "
            f"{steuer.prozent_formatieren(afa['satz'])}, Restwert "
            f"{betrag_formatieren(afa['restwert'])} €"))
        _geld(blatt.cell(zeile, 5), afa["betrag"])
    else:
        blatt.cell(zeile, 2, "Gebäude-AfA nicht hinterlegt – beim "
                             "Steuerberater erfragen")
    zeile += 1
    for inv in daten["investitionen"]:
        blatt.cell(zeile, 2, f"{datum_anzeigen(inv['datum'])} "
                             f"{inv['beschreibung']} ({inv['typ']}, gesamt "
                             f"{betrag_formatieren(inv['gesamt'])} €)")
        _geld(blatt.cell(zeile, 5), inv["anteil"])
        zeile += 1

    zeile += 1
    blatt.cell(zeile, 1, "Nicht berücksichtigt").font = _FETT
    zeile += 1
    summen: dict[str, Decimal] = {}
    for p in daten["nicht_beruecksichtigt"]:
        summen[_art_text(p)] = summen.get(_art_text(p), Decimal("0")) \
            + p["betrag"]
    if not summen:
        blatt.cell(zeile, 2, "—")
    for text, summe in sorted(summen.items()):
        blatt.cell(zeile, 2, text)
        _geld(blatt.cell(zeile, 3), summe)
        zeile += 1


def _blatt_einzelnachweis(wb, verbindung, jahr, beleg_links) -> None:
    blatt = wb.create_sheet("Einzelnachweis")
    titel = ["Beleg-Nr", "Datum", "Steuer-jahr", "Haus", "Zeile",
             "Anlage-V-Position", "Kategorie", "Steuerliche Art", "Mieter",
             "Beschreibung", "Betrag", "Zahlung (+ein/−aus)", "Anteil %",
             "Anteil laut", "Angesetzt", "Nicht angesetzt", "Beleg"]
    _breiten(blatt, [10, 11, 8, 18, 7, 34, 26, 30, 18, 50, 13, 14, 9, 11,
                     13, 13, 40])
    _kopfzeile(blatt, 1, titel)
    blatt.freeze_panes = "A2"
    zeile = 2
    for p in steuer.posten_laden(verbindung, jahr):
        werte = [
            p["belegnr"], datum_anzeigen(p["datum"]), p["steuerjahr"],
            p["haus"] or "(ohne Haus)",
            steuer.zeilennummer(verbindung, p["position"])
            if p["position"] else "",
            _position_text(p), p["kategorie"], _art_text(p), p["mieter"] or "",
            p["beschreibung"],
        ]
        for spalte, wert in enumerate(werte, start=1):
            blatt.cell(zeile, spalte, wert)
        _geld(blatt.cell(zeile, 11), p["betrag"])
        _geld(blatt.cell(zeile, 12), p["kasse"])
        blatt.cell(zeile, 13, float(p["prozent"]))
        blatt.cell(zeile, 14, p["prozent_quelle"])
        _geld(blatt.cell(zeile, 15), p["angesetzt"])
        _geld(blatt.cell(zeile, 16), p["nicht_angesetzt"])
        if p["id"] in beleg_links:
            zelle = blatt.cell(zeile, 17, beleg_links[p["id"]])
            zelle.hyperlink = beleg_links[p["id"]]
            zelle.font = Font(color="0563C1", underline="single")
        elif p["beleg_pfad"]:
            blatt.cell(zeile, 17, p["beleg_pfad"])
        else:
            blatt.cell(zeile, 17, "kein Beleg")
        if p["ungeklaert"]:
            for spalte in range(1, 18):
                blatt.cell(zeile, spalte).fill = PatternFill(
                    "solid", fgColor=_STUFE_FARBE[steuer.FEHLER])
        zeile += 1
    blatt.auto_filter.ref = f"A1:Q{max(zeile - 1, 1)}"


def _blatt_pruefung(wb, hinweise: list[dict]) -> None:
    blatt = wb.create_sheet("Prüfhinweise")
    _breiten(blatt, [10, 12, 110, 20])
    _kopfzeile(blatt, 1, ["Stufe", "Bereich", "Hinweis", "Beleg-Nr"])
    if not hinweise:
        blatt.cell(2, 3, "Keine Auffälligkeiten gefunden.")
    for zeile, h in enumerate(hinweise, start=2):
        blatt.cell(zeile, 1, steuer.STUFEN_TEXT[h["stufe"]])
        blatt.cell(zeile, 2, h["bereich"])
        blatt.cell(zeile, 3, h["text"]).alignment = Alignment(wrap_text=True)
        blatt.cell(zeile, 4, ", ".join(f"B{i:05d}" for i in
                                       h["buchung_ids"][:10]))
        for spalte in range(1, 5):
            blatt.cell(zeile, spalte).fill = PatternFill(
                "solid", fgColor=_STUFE_FARBE[h["stufe"]])


def anlage_v_excel(
    verbindung: sqlite3.Connection, jahr: int, ziel: Path | None = None,
    beleg_links: dict[int, str] | None = None,
) -> Path:
    """Schreibt Anlage V, Einzelnachweis und Prüfbericht als Excel-Datei."""
    wb = Workbook()
    uebersicht = wb.active
    uebersicht.title = "Übersicht"
    haeuser = steuer.haeuser_mit_daten(verbindung, jahr)
    auswertungen = [steuer.auswertung(verbindung, h["id"], jahr)
                    for h in haeuser]
    uebersicht.cell(1, 1, f"Einkünfte aus Vermietung und Verpachtung {jahr}"
                    ).font = Font(bold=True, size=14)
    uebersicht.cell(2, 1, f"Erstellt am {date.today().strftime('%d.%m.%Y')}."
                    " Je Haus ist eine eigene Anlage V abzugeben.")
    uebersicht.cell(3, 1, f"Zeilennummern: {steuer.ZEILEN_STAND}").font = \
        Font(italic=True, color="7F6000")
    _breiten(uebersicht, [9, 52] + [18] * (len(auswertungen) + 1))
    _kopfzeile(uebersicht, 5, ["Zeile", "Position"]
               + [a["haus"] for a in auswertungen] + ["Summe"])
    zeile = 6
    for pos in steuer.POSITIONEN:
        uebersicht.cell(zeile, 1, steuer.zeilennummer(verbindung,
                                                      pos.schluessel))
        uebersicht.cell(zeile, 2, pos.bezeichnung)
        summe = Decimal("0")
        for spalte, a in enumerate(auswertungen, start=3):
            wert = a["positionen"][pos.schluessel]["angesetzt"]
            _geld(uebersicht.cell(zeile, spalte), wert)
            summe += wert
        _geld(uebersicht.cell(zeile, 3 + len(auswertungen)), summe)
        if pos.gruppe == "summe":
            for spalte in range(1, 4 + len(auswertungen)):
                uebersicht.cell(zeile, spalte).font = _FETT
        zeile += 1

    hinweise = steuer.pruefen(verbindung, jahr)
    fehler = sum(1 for h in hinweise if h["stufe"] == steuer.FEHLER)
    zeile += 1
    uebersicht.cell(zeile, 1, (
        f"Prüfbericht: {fehler} Fehler, "
        f"{sum(1 for h in hinweise if h['stufe'] == steuer.WARNUNG)} zu "
        f"prüfen, {sum(1 for h in hinweise if h['stufe'] == steuer.INFO)} "
        "Hinweise – siehe Blatt „Prüfhinweise“."))
    uebersicht.cell(zeile, 1).font = Font(
        bold=True, color="C00000" if fehler else "1F7A4D")

    ohne_haus = steuer.posten_laden(verbindung, jahr, None)
    if ohne_haus:
        zeile += 1
        uebersicht.cell(zeile, 1, f"{len(ohne_haus)} Buchung(en) ohne Haus "
                        "sind in keiner Anlage V enthalten.").font = Font(
            bold=True, color="C00000")

    for daten in auswertungen:
        _blatt_haus(wb, verbindung, daten)
    _blatt_einzelnachweis(wb, verbindung, jahr, beleg_links or {})
    _blatt_pruefung(wb, hinweise)

    ziel = ziel or exporte_verzeichnis() / f"AnlageV_{jahr}.xlsx"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    wb.save(ziel)
    return ziel


# =========================================================================
# PDF-Bericht je Haus
# =========================================================================


def steuerbericht_html(
    verbindung: sqlite3.Connection, daten: dict, hinweise: list[dict]
) -> str:
    """HTML des Steuerberater-Berichts für ein Haus."""
    g = betrag_formatieren
    zeilen = ""
    for pos in steuer.POSITIONEN:
        w = daten["positionen"][pos.schluessel]
        fett = pos.gruppe == "summe"
        auf, zu = ("<b>", "</b>") if fett else ("", "")
        zeilen += (
            f"<tr><td>{html.escape(steuer.zeilennummer(verbindung, pos.schluessel))}"
            f"</td><td>{auf}{html.escape(pos.bezeichnung)}{zu}</td>"
            f"<td align='right'>{auf}{g(w['gesamt'])} €{zu}</td>"
            f"<td align='right'>{auf}{g(w['angesetzt'])} €{zu}</td></tr>"
        )
    afa = daten["afa_gebaeude"]
    afa_html = (
        f"<p>Gebäude-AfA: Bemessungsgrundlage {g(afa['bemessung'])} €, "
        f"Beginn {datum_anzeigen(afa['beginn'])}, Satz "
        f"{steuer.prozent_formatieren(afa['satz'])} → {g(afa['betrag'])} € "
        f"(Restwert {g(afa['restwert'])} €)</p>"
        if afa else
        "<p><b>Gebäude-AfA nicht hinterlegt.</b> Bitte aus Vorjahres-"
        "erklärung/Kaufvertrag übernehmen.</p>"
    )
    inv = "".join(
        f"<tr><td>{datum_anzeigen(i['datum'])}</td>"
        f"<td>{html.escape(i['beschreibung'])}</td>"
        f"<td>{html.escape(i['typ'])}</td>"
        f"<td align='right'>{g(i['gesamt'])} €</td>"
        f"<td align='right'>{g(i['anteil'])} €</td></tr>"
        for i in daten["investitionen"]
    )
    if inv:
        afa_html += (
            "<table border='1' cellspacing='0' cellpadding='3' width='100%'>"
            "<tr><th>Datum</th><th>Beschreibung</th><th>Art</th>"
            "<th>Gesamt</th><th>Anteil Jahr</th></tr>" + inv + "</table>")

    einzel = "".join(
        f"<tr><td>{p['belegnr']}</td><td>{datum_anzeigen(p['datum'])}</td>"
        f"<td>{html.escape(p['kategorie'] or '')}</td>"
        f"<td>{html.escape(p['beschreibung'][:55])}</td>"
        f"<td align='right'>{g(p['wert'])}</td>"
        f"<td align='right'>{p['prozent'].normalize():f}</td>"
        f"<td align='right'>{g(p['angesetzt'])}</td>"
        f"<td align='center'>{'ja' if p['beleg_pfad'] else '–'}</td></tr>"
        for p in daten["posten"]
    )
    nicht = "".join(
        f"<tr><td>{p['belegnr']}</td><td>{datum_anzeigen(p['datum'])}</td>"
        f"<td>{html.escape(p['kategorie'] or '')}</td>"
        f"<td>{html.escape(_art_text(p))}</td>"
        f"<td align='right'>{g(p['betrag'])}</td></tr>"
        for p in daten["nicht_beruecksichtigt"]
    )
    # Alle Hinweise zu diesem Haus plus übergreifende Fehler/Warnungen.
    eigene = [
        h for h in hinweise
        if h["objekt_id"] == daten["objekt_id"]
        or (h["objekt_id"] is None and h["stufe"] != steuer.INFO)
    ]
    hinweis_html = "".join(
        f"<li><b>{steuer.STUFEN_TEXT[h['stufe']]}:</b> "
        f"{html.escape(h['text'])}</li>" for h in eigene[:40]
    ) or "<li>Keine Auffälligkeiten.</li>"

    return f"""
    <h2>Anlage V {daten['jahr']} – {html.escape(daten['haus'])}</h2>
    <p>{html.escape(daten['adresse'] or 'Adresse nicht hinterlegt')}<br>
    Erstellt am {date.today().strftime('%d.%m.%Y')} · Beträge in Euro,
    cent-genau · <i>Zeilennummern: {html.escape(steuer.ZEILEN_STAND)}</i></p>
    <table border='1' cellspacing='0' cellpadding='4' width='100%'>
      <tr><th>Zeile</th><th align='left'>Position</th>
      <th align='right'>Gesamtbetrag</th>
      <th align='right'>Anzusetzen</th></tr>
      {zeilen}
    </table>
    <h3>AfA und Investitionen</h3>
    {afa_html}
    <h3>Prüfhinweise</h3>
    <ul>{hinweis_html}</ul>
    <h3>Einzelnachweis (angesetzte Buchungen)</h3>
    <table border='1' cellspacing='0' cellpadding='2' width='100%'>
      <tr><th>Beleg</th><th>Datum</th><th>Kategorie</th><th>Text</th>
      <th>Betrag</th><th>%</th><th>Angesetzt</th><th>Beleg</th></tr>
      {einzel}
    </table>
    <h3>Nicht berücksichtigt (privat, neutral, AfA-pflichtig, ungeklärt)</h3>
    <table border='1' cellspacing='0' cellpadding='2' width='100%'>
      <tr><th>Beleg</th><th>Datum</th><th>Kategorie</th><th>Behandlung</th>
      <th>Betrag</th></tr>
      {nicht or "<tr><td colspan='5'>—</td></tr>"}
    </table>
    <p><i>Automatisch erstellt aus der Hausverwaltungs-Software. Vor Abgabe
    prüfen; Zeilennummern mit dem amtlichen Vordruck abgleichen.</i></p>
    """


def steuerbericht_pdfs(
    verbindung: sqlite3.Connection, jahr: int, ordner: Path | None = None
) -> list[Path]:
    """Erstellt je Haus einen PDF-Steuerbericht (benötigt Qt)."""
    from src.logic.nebenkosten import html_nach_pdf

    ordner = ordner or exporte_verzeichnis()
    ordner.mkdir(parents=True, exist_ok=True)
    hinweise = steuer.pruefen(verbindung, jahr)
    erstellt: list[Path] = []
    for haus in steuer.haeuser_mit_daten(verbindung, jahr):
        daten = steuer.auswertung(verbindung, haus["id"], jahr)
        ziel = ordner / f"Steuerbericht_{_dateiname(daten['haus'])}_{jahr}.pdf"
        html_nach_pdf(steuerbericht_html(verbindung, daten, hinweise), ziel)
        erstellt.append(ziel)
    return erstellt


# =========================================================================
# Steuerpaket
# =========================================================================


def steuerpaket_erstellen(
    verbindung: sqlite3.Connection, jahr: int, mit_pdf: bool = True
) -> dict:
    """Erstellt den kompletten Ordner für den Steuerberater plus ZIP.

    Inhalt: Anlage V (Excel inkl. Einzelnachweis und Prüfbericht),
    PDF-Berichte je Haus, Mieteinnahmen-Nachweis, DATEV-Buchungsstapel
    (wenn Berater-/Mandantennummer eingetragen) und alle Belege.
    """
    from src.logic import datev
    from src.utils.eingaben import ValidierungsFehler

    ordner = exporte_verzeichnis() / f"Steuerpaket_{jahr}"
    if ordner.exists():
        shutil.rmtree(ordner)
    ordner.mkdir(parents=True)
    links, fehlende_belege = belege_sammeln(verbindung, jahr,
                                            ordner / "Belege")
    dateien = [anlage_v_excel(verbindung, jahr,
                              ordner / f"AnlageV_{jahr}.xlsx", links)]
    meldungen: list[str] = []
    if fehlende_belege:
        meldungen.append(f"{len(fehlende_belege)} Beleg-Datei(en) nicht "
                         "gefunden: " + "; ".join(fehlende_belege[:5]))
    if mit_pdf:
        dateien += steuerbericht_pdfs(verbindung, jahr, ordner)
        from src.logic.nebenkosten import mieteinnahmen_pdf
        dateien.append(mieteinnahmen_pdf(verbindung, None, jahr,
                                         "Alle Häuser", ordner=ordner))
    try:
        pfad, datev_hinweise = datev.buchungsstapel_schreiben(
            verbindung, jahr, ordner / f"EXTF_Buchungsstapel_{jahr}.csv")
        dateien.append(pfad)
        meldungen += datev_hinweise[:5]
    except ValidierungsFehler as fehler:
        meldungen.append(f"DATEV-Datei nicht erstellt: {fehler}")

    archiv = exporte_verzeichnis() / f"Steuerpaket_{jahr}.zip"
    with zipfile.ZipFile(archiv, "w", zipfile.ZIP_DEFLATED) as zip_datei:
        for datei in sorted(ordner.rglob("*")):
            if datei.is_file():
                zip_datei.write(datei, datei.relative_to(ordner.parent))
    hinweise = steuer.pruefen(verbindung, jahr)
    return {
        "ordner": ordner,
        "zip": archiv,
        "dateien": dateien,
        "belege": len(links),
        "meldungen": meldungen,
        "fehler": sum(1 for h in hinweise if h["stufe"] == steuer.FEHLER),
        "warnungen": sum(1 for h in hinweise
                         if h["stufe"] == steuer.WARNUNG),
    }
