"""Nebenkostenabrechnung: Berechnung und Export (Excel + PDF).

Je Haus werden die als umlagefähig markierten Ausgaben eines Jahres
zusammengezählt und nach dem Umlageschlüssel des Hauses auf die Mieter
verteilt. Aus den geleisteten Vorauszahlungen ergibt sich je Mieter
eine Nachzahlung oder ein Guthaben.

Bei unterjährigem Ein- oder Auszug wird der Umlageschlüssel taggenau
mit dem Nutzungsanteil gewichtet (z. B. 60 m² × 184/365 Tage).

Cent-genau: Jede Kostenart wird einzeln verteilt; Rundungscents gehen
nach dem Verfahren der größten Reste an die Beteiligten, sodass die
Summe aller Anteile exakt den Kosten entspricht.

Leerstand: Ist beim Haus die Gesamtwohnfläche hinterlegt, ist sie
(beim Flächenschlüssel) der Nenner. Kosten leerstehender Flächen bzw.
Zeiträume trägt dann der Vermieter, nicht die übrigen Mieter (so
verlangt es die Rechtsprechung). Ohne Gesamtwohnfläche wird über die
Summe der Mieterflächen verteilt und ein Hinweis ausgegeben.

Vorauszahlungen: maßgeblich sind die tatsächlich gebuchten
Nebenkosten-Vorauszahlungen des Mieters (Ist). Nur wenn keine gebucht
sind, wird hilfsweise die vertragliche Vorauszahlung × abgehakte
Monate angesetzt (Hinweis in der Abrechnung).

Vereinfachungen (bewusst, für die private Nutzung):
* Abrechnungszeitraum ist stets das Kalenderjahr.
* Heizkosten werden wie alle übrigen umlagefähigen Kosten verteilt
  (keine verbrauchsabhängige Abrechnung nach Heizkostenverordnung).
"""

from __future__ import annotations

import html
import sqlite3
from datetime import date
from decimal import ROUND_FLOOR, Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font

from src.db.mietzahlungen import bezahlte_monate
from src.db.stammdaten import UMLAGESCHLUESSEL, objekte_laden
from src.utils.eingaben import ValidierungsFehler, betrag_formatieren
from src.utils.paths import exporte_verzeichnis

_CENT = Decimal("0.01")
_WAEHRUNG = '#,##0.00 "€"'


def _datum_lesen(text: str | None) -> date | None:
    """Liest ein ISO-Datum (YYYY-MM-DD) tolerant ein."""
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def zeitanteil_im_jahr(
    aktiv_von: str | None, aktiv_bis: str | None, jahr: int
) -> tuple[Decimal, date | None, date | None]:
    """Berechnet den taggenauen Nutzungsanteil eines Mieters am Jahr.

    Liefert ``(anteil, nutzung_von, nutzung_bis)``: der Anteil liegt
    zwischen 0 (Zeitraum berührt das Jahr nicht) und 1 (ganzjährig);
    die beiden Daten begrenzen den tatsächlichen Nutzungszeitraum
    innerhalb des Jahres. Bei unterjährigem Ein-/Auszug trägt der
    Mieter nur den Anteil seiner Nutzungstage.
    """
    jahr_start = date(jahr, 1, 1)
    jahr_ende = date(jahr, 12, 31)
    von = _datum_lesen(aktiv_von) or jahr_start
    bis = _datum_lesen(aktiv_bis) or jahr_ende
    start = max(von, jahr_start)
    ende = min(bis, jahr_ende)
    if ende < start:
        return Decimal("0"), None, None
    tage = (ende - start).days + 1
    jahr_tage = (jahr_ende - jahr_start).days + 1
    return Decimal(tage) / Decimal(jahr_tage), start, ende


_JAHR_FILTER = (
    "((b.steuerjahr IS NULL AND substr(b.datum, 1, 4) = ?) "
    " OR b.steuerjahr = ?)"
)


def umlagefaehige_buchungen(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> list[dict]:
    """Liefert die einzelnen umlagefähigen Buchungen eines Hauses im Jahr.

    Jeder Eintrag enthält Datum, Kategorie, Beschreibung, Betrag und ob
    ein Beleg hinterlegt ist — die Grundlage für die Belegliste der
    Abrechnung und für den Hinweis, wo noch Belege fehlen. Erstattungen
    (Gegenbuchungen) sind negativ und mindern die Kosten.
    """
    zeilen = verbindung.execute(
        "SELECT b.id, b.datum, b.betrag, b.beschreibung, b.beleg_pfad, "
        "k.name AS kategorie_name "
        "FROM buchungen b JOIN kategorien k ON k.id = b.kategorie_id "
        f"WHERE b.objekt_id = ? AND {_JAHR_FILTER} "
        "AND k.typ = 'ausgabe' AND k.umlagefaehig = 1 "
        "ORDER BY b.datum, b.id",
        (objekt_id, f"{jahr:04d}", jahr),
    ).fetchall()
    ergebnis: list[dict] = []
    for zeile in zeilen:
        try:
            betrag = Decimal(zeile["betrag"])
        except (ValueError, TypeError, ArithmeticError):
            continue
        ergebnis.append({
            "id": zeile["id"],
            "datum": zeile["datum"],
            "kategorie": zeile["kategorie_name"],
            "beschreibung": zeile["beschreibung"] or "",
            "betrag": betrag,
            "beleg": bool(zeile["beleg_pfad"]),
        })
    return ergebnis


def _umlagefaehige_kosten(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> list[tuple[str, Decimal]]:
    """Liefert die umlagefähigen Ausgaben eines Hauses je Kategorie."""
    summen: dict[str, Decimal] = {}
    for b in umlagefaehige_buchungen(verbindung, objekt_id, jahr):
        summen[b["kategorie"]] = summen.get(b["kategorie"], Decimal("0")) \
            + b["betrag"]
    return sorted(summen.items())


def cent_genau_verteilen(
    betrag: Decimal, gewichte: list[Decimal], nenner: Decimal
) -> list[Decimal]:
    """Verteilt ``betrag`` cent-genau im Verhältnis ``gewicht / nenner``.

    Ist ``nenner`` größer als die Summe der Gewichte, bleibt der Rest
    (z. B. Leerstand) unverteilt und wird als letzter Listeneintrag
    zurückgegeben. Rundungscents gehen an die größten Nachkommareste.
    Die Summe der Rückgabe ist immer exakt ``betrag``.
    """
    if nenner <= 0 or not gewichte:
        return [Decimal("0")] * len(gewichte) + [betrag]
    vorzeichen = -1 if betrag < 0 else 1
    cents_gesamt = int((abs(betrag) * 100).to_integral_value())
    rest_gewicht = max(nenner - sum(gewichte, Decimal("0")), Decimal("0"))
    alle = list(gewichte) + [rest_gewicht]
    exakt = [Decimal(cents_gesamt) * g / nenner for g in alle]
    ganz = [int(e.to_integral_value(rounding=ROUND_FLOOR)) for e in exakt]
    fehlend = cents_gesamt - sum(ganz)
    reihenfolge = sorted(
        range(len(alle)), key=lambda i: (exakt[i] - ganz[i], -i), reverse=True
    )
    for i in reihenfolge[:fehlend]:
        ganz[i] += 1
    return [Decimal(vorzeichen * c) / 100 for c in ganz]


def _vorauszahlungen_ist(
    verbindung: sqlite3.Connection, mieter_id: int, jahr: int
) -> tuple[Decimal, int]:
    """Summe der tatsächlich gebuchten NK-Vorauszahlungen eines Mieters.

    Zählt positive Buchungen auf der Kategorie mit Rolle „nebenkosten“
    (bzw. steuerlicher Art „umlagen“), deren Leistungsmonat im Jahr liegt
    (Zahlung ab dem 25. gilt für den Folgemonat, ein gesetztes Steuerjahr
    hat Vorrang). Nach- und Rückzahlungen aus Abrechnungen bleiben außen
    vor. Liefert ``(summe, anzahl_buchungen)``.
    """
    from src.logic.import_buchen import leistungsmonat

    zeilen = verbindung.execute(
        "SELECT b.datum, b.betrag, b.steuerjahr, b.beschreibung "
        "FROM buchungen b JOIN kategorien k ON k.id = b.kategorie_id "
        "WHERE b.mieter_id = ? AND k.typ = 'einnahme' "
        "AND (k.rolle = 'nebenkosten' OR k.steuer_art = 'umlagen') "
        "AND substr(b.datum, 1, 4) BETWEEN ? AND ?",
        (mieter_id, f"{jahr - 1:04d}", f"{jahr + 1:04d}"),
    ).fetchall()
    summe = Decimal("0")
    anzahl = 0
    for z in zeilen:
        try:
            betrag = Decimal(z["betrag"])
        except (ValueError, TypeError, ArithmeticError):
            continue
        text = (z["beschreibung"] or "").lower()
        if betrag <= 0 or "nachzahlung" in text or "abrechnung" in text:
            continue
        if z["steuerjahr"] is not None:
            effektiv = int(z["steuerjahr"])
        else:
            try:
                effektiv = leistungsmonat(z["datum"])[0]
            except ValueError:
                continue
        if effektiv == jahr:
            summe += betrag
            anzahl += 1
    return summe, anzahl


def abrechnung_erstellen(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> dict:
    """Berechnet die Nebenkostenabrechnung eines Hauses für ein Jahr."""
    haus = verbindung.execute(
        "SELECT name, umlageschluessel, gesamtflaeche FROM objekte "
        "WHERE id = ?",
        (objekt_id,),
    ).fetchone()
    if haus is None:
        raise ValidierungsFehler("Das Haus wurde nicht gefunden.")
    schluessel = haus["umlageschluessel"]

    kosten = _umlagefaehige_kosten(verbindung, objekt_id, jahr)
    kosten_gesamt = sum((betrag for _, betrag in kosten), Decimal("0"))

    alle_mieter = verbindung.execute(
        "SELECT id, name, nebenkosten, aktiv_von, aktiv_bis, wohnflaeche, "
        "personenzahl, umlage_gewicht FROM mieter WHERE objekt_id = ? "
        "ORDER BY name COLLATE NOCASE",
        (objekt_id,),
    ).fetchall()

    def schluesselwert(zeile: sqlite3.Row) -> Decimal:
        # Manuell gesetztes Umlage-Gewicht hat Vorrang (Aufteilung
        # bearbeiten): überschreibt den automatischen Schlüssel.
        manuell = zeile["umlage_gewicht"]
        if manuell is not None and str(manuell).strip() != "":
            try:
                return Decimal(str(manuell))
            except (ValueError, TypeError, ArithmeticError):
                pass
        if schluessel == "personen":
            return Decimal(zeile["personenzahl"])
        if schluessel == "gleich":
            return Decimal("1")
        try:
            return Decimal(str(zeile["wohnflaeche"]))
        except (ValueError, TypeError, ArithmeticError):
            return Decimal("0")

    # Taggenauer Nutzungsanteil je Mieter: bei unterjährigem Ein- oder
    # Auszug wird der Umlageschlüssel mit dem Zeitanteil gewichtet
    # (z. B. 60 m² × ein halbes Jahr = 30 gewichtete Anteile).
    mieter: list[tuple[sqlite3.Row, Decimal, date, date]] = []
    for m in alle_mieter:
        anteil_zeit, von, bis = zeitanteil_im_jahr(
            m["aktiv_von"], m["aktiv_bis"], jahr
        )
        if anteil_zeit > 0:
            mieter.append((m, anteil_zeit, von, bis))

    gewichte = [schluesselwert(m) * anteil_zeit
                for m, anteil_zeit, _, _ in mieter]
    summe_gewichte = sum(gewichte, Decimal("0"))

    hinweise: list[str] = []
    nenner = summe_gewichte
    gesamtflaeche = None
    try:
        if haus["gesamtflaeche"] not in (None, ""):
            gesamtflaeche = Decimal(str(haus["gesamtflaeche"]))
    except (ValueError, TypeError, ArithmeticError):
        gesamtflaeche = None
    if schluessel == "flaeche":
        if gesamtflaeche and gesamtflaeche > 0:
            if summe_gewichte > gesamtflaeche:
                hinweise.append(
                    "Die Mieterflächen ergeben mehr als die hinterlegte "
                    "Gesamtwohnfläche – es wird über die Mieterflächen "
                    "verteilt. Bitte Flächen prüfen."
                )
            else:
                nenner = gesamtflaeche
        else:
            hinweise.append(
                "Keine Gesamtwohnfläche beim Haus hinterlegt: Kosten "
                "leerstehender Flächen/Zeiten werden auf die übrigen Mieter "
                "verteilt. Rechtlich trägt sie der Vermieter – bitte unter "
                "Stammdaten → Häuser → Steuer-Daten eintragen."
            )

    # Cent-genaue Verteilung je Kostenart.
    je_kostenart: dict[str, list[Decimal]] = {}
    for name, betrag in kosten:
        je_kostenart[name] = cent_genau_verteilen(betrag, gewichte, nenner)
    anteil_vermieter = sum(
        (anteile[-1] for anteile in je_kostenart.values()), Decimal("0")
    )

    mieter_ergebnis = []
    for index, (m, anteil_zeit, von, bis) in enumerate(mieter):
        wert = gewichte[index]
        anteil = (wert / nenner) if nenner > 0 else Decimal("0")
        kostenanteile = [
            (name, je_kostenart[name][index]) for name, _ in kosten
        ]
        kostenanteil = sum((b for _, b in kostenanteile), Decimal("0"))
        monate = len(bezahlte_monate(verbindung, m["id"], jahr))
        ist, anzahl_ist = _vorauszahlungen_ist(verbindung, m["id"], jahr)
        try:
            monatlich = Decimal(str(m["nebenkosten"]))
        except (ValueError, TypeError, ArithmeticError):
            monatlich = Decimal("0")
        soll = (monatlich * monate).quantize(_CENT)
        vorauszahlung = ist if anzahl_ist else soll
        mieter_ergebnis.append({
            "name": m["name"],
            "schluesselwert": wert,
            "anteil": anteil,
            "zeitanteil": anteil_zeit,
            "nutzung_von": von.isoformat(),
            "nutzung_bis": bis.isoformat(),
            "kostenanteile": kostenanteile,
            "kostenanteil": kostenanteil,
            "monate": monate,
            "vorauszahlung": vorauszahlung,
            "vorauszahlung_quelle": "gebucht" if anzahl_ist else "vertraglich",
            "vorauszahlung_soll": soll,
            "differenz": vorauszahlung - kostenanteil,
        })

    einzelbuchungen = umlagefaehige_buchungen(verbindung, objekt_id, jahr)
    return {
        "haus": haus["name"],
        "jahr": jahr,
        "umlageschluessel": schluessel,
        "gesamtflaeche": gesamtflaeche,
        "kosten": kosten,
        "kosten_gesamt": kosten_gesamt,
        "anteil_vermieter": anteil_vermieter,
        "mieter": mieter_ergebnis,
        "einzelbuchungen": einzelbuchungen,
        "belege_fehlen": sum(1 for b in einzelbuchungen if not b["beleg"]),
        "hinweise": hinweise,
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
            blatt.cell(zeile, 2, f"{eintrag['anteil'] * 100:.2f} %")
            for spalte, schluessel in (
                (3, "kostenanteil"), (4, "vorauszahlung"), (5, "differenz")
            ):
                zelle = blatt.cell(zeile, spalte, float(eintrag[schluessel]))
                zelle.number_format = _WAEHRUNG
            blatt.cell(zeile, 6, f"Vorauszahlung {eintrag['vorauszahlung_quelle']}")
            zeile += 1
        if abrechnung["anteil_vermieter"]:
            blatt.cell(zeile, 1, "Leerstand / Anteil Vermieter")
            zelle = blatt.cell(zeile, 3, float(abrechnung["anteil_vermieter"]))
            zelle.number_format = _WAEHRUNG
            zeile += 1
        for hinweis in abrechnung["hinweise"]:
            blatt.cell(zeile, 1, "Hinweis: " + hinweis)
            zeile += 1
        zeile += 2

    ziel = exporte_verzeichnis() / f"Nebenkosten_{jahr}.xlsx"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    arbeitsmappe.save(ziel)
    return ziel


def abrechnung_html(abrechnung: dict, eintrag: dict) -> str:
    """Erzeugt den HTML-Inhalt der Abrechnung für einen einzelnen Mieter."""
    schluessel_text = UMLAGESCHLUESSEL[abrechnung["umlageschluessel"]]
    ihr_anteil = dict(eintrag.get("kostenanteile", []))
    kosten_zeilen = "".join(
        f"<tr><td>{html.escape(name)}</td>"
        f"<td align='right'>{betrag_formatieren(betrag)} €</td>"
        f"<td align='right'>{betrag_formatieren(ihr_anteil.get(name, 0))} €"
        f"</td></tr>"
        for name, betrag in abrechnung["kosten"]
    )
    differenz = eintrag["differenz"]
    if differenz >= 0:
        fazit = (f"Guthaben — Rückzahlung an den Mieter: "
                 f"{betrag_formatieren(differenz)} €")
    else:
        fazit = (f"Nachzahlung durch den Mieter: "
                 f"{betrag_formatieren(-differenz)} €")

    def datum_de(iso: str) -> str:
        return f"{iso[8:10]}.{iso[5:7]}.{iso[:4]}"

    # Belegliste: jede einzelne umlagefähige Buchung des Hauses.
    einzel_zeilen = "".join(
        f"<tr><td>{datum_de(b['datum'])}</td>"
        f"<td>{html.escape(b['kategorie'])}</td>"
        f"<td>{html.escape(b['beschreibung'][:70])}</td>"
        f"<td align='right'>{betrag_formatieren(b['betrag'])} €</td>"
        f"<td align='center'>{'✓' if b['beleg'] else '—'}</td></tr>"
        for b in abrechnung.get("einzelbuchungen", [])
    )
    belegliste = ""
    if einzel_zeilen:
        belegliste = (
            "<h3>Kostenaufstellung im Einzelnen</h3>"
            "<table border='1' cellspacing='0' cellpadding='4' width='100%'>"
            "<tr><th>Datum</th><th>Kategorie</th><th>Beschreibung</th>"
            "<th align='right'>Betrag</th><th>Beleg</th></tr>"
            + einzel_zeilen +
            "</table>"
            "<p><i>Die Belege können nach Terminabsprache eingesehen "
            "werden.</i></p>"
        )

    if eintrag.get("vorauszahlung_quelle") == "vertraglich":
        vorauszahlung_text = (
            f"Vorauszahlung laut Vertrag ({eintrag['monate']} Monate)")
    else:
        vorauszahlung_text = "Von Ihnen geleistete Vorauszahlungen"

    zeitanteil = eintrag.get("zeitanteil", Decimal("1"))
    nutzungszeile = ""
    if zeitanteil < 1:
        nutzungszeile = (
            "<tr><td>Ihr Nutzungszeitraum (taggenau)</td>"
            f"<td align='right'>{datum_de(eintrag['nutzung_von'])} – "
            f"{datum_de(eintrag['nutzung_bis'])} "
            f"({zeitanteil * 100:.1f} % des Jahres)</td></tr>"
        )

    return f"""
    <h2>Nebenkostenabrechnung {abrechnung['jahr']}</h2>
    <p>
      <b>Haus:</b> {html.escape(abrechnung['haus'])}<br>
      <b>Mieter:</b> {html.escape(eintrag['name'])}<br>
      <b>Abrechnungszeitraum:</b>
      01.01.{abrechnung['jahr']} – 31.12.{abrechnung['jahr']}<br>
      <b>Umlageschlüssel:</b> {schluessel_text}
    </p>
    <h3>Umlagefähige Kosten des Hauses und Ihr Anteil</h3>
    <table border='1' cellspacing='0' cellpadding='5' width='100%'>
      <tr><th align='left'>Kostenart</th><th align='right'>Gesamtkosten</th>
      <th align='right'>Ihr Anteil</th></tr>
      {kosten_zeilen}
      <tr><td><b>Summe</b></td><td align='right'><b>
      {betrag_formatieren(abrechnung['kosten_gesamt'])} €</b></td>
      <td align='right'><b>{betrag_formatieren(eintrag['kostenanteil'])} €</b>
      </td></tr>
    </table>
    <h3>Ihr Anteil</h3>
    <table border='1' cellspacing='0' cellpadding='5' width='100%'>
      {nutzungszeile}
      <tr><td>Anteil ({schluessel_text})</td>
        <td align='right'>{eintrag['anteil'] * 100:.2f} %</td></tr>
      <tr><td>Ihr Kostenanteil</td>
        <td align='right'>{betrag_formatieren(eintrag['kostenanteil'])} €</td></tr>
      <tr><td>{vorauszahlung_text}</td>
        <td align='right'>
        {betrag_formatieren(eintrag['vorauszahlung'])} €</td></tr>
    </table>
    <h3>{fazit}</h3>
    {belegliste}
    <p><i>Hinweis: Diese Abrechnung wurde automatisch erstellt und ist
    vor Weitergabe zu prüfen.</i></p>
    """


def html_nach_pdf(
    inhalt_html: str, ziel_pfad: Path, quer: bool = False
) -> None:
    """Schreibt einen HTML-Inhalt als PDF-Datei (über Qt, ohne Zusatzpaket).

    ``quer=True`` erzeugt A4-Querformat (für breite Tabellen).
    """
    from PySide6.QtGui import (
        QPageLayout, QPageSize, QPdfWriter, QTextDocument,
    )

    schreiber = QPdfWriter(str(ziel_pfad))
    schreiber.setPageSize(QPageSize(QPageSize.A4))
    if quer:
        schreiber.setPageOrientation(QPageLayout.Landscape)
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


# =========================================================================
# Mieteinnahmen-Nachweis (für die Steuer / Anlage V)
# =========================================================================

_MONATE_KURZ = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
]


def mieteinnahmen_daten(
    verbindung: sqlite3.Connection, objekt_id: int | None, jahr: int
) -> dict:
    """Sammelt die tatsächlich eingegangenen Mieten je Mieter für ein Jahr.

    Grundlage für den Steuer-Nachweis „wer wann wie viel gezahlt hat".
    Maßgeblich sind die gebuchten Zahlungseingänge (Kaltmiete und
    Nebenkosten-Vorauszahlungen, Zuflussprinzip), nicht die Checkliste —
    so stimmt die Summe mit den Einnahmen der Anlage V überein.
    Buchungen ohne Mieter erscheinen in einer eigenen Zeile.
    ``objekt_id=None`` wertet alle Häuser aus.
    """
    from src.logic.steuer import posten_laden

    if objekt_id is None:
        posten = posten_laden(verbindung, jahr)
    else:
        posten = posten_laden(verbindung, jahr, objekt_id)
    soll = {
        z["id"]: z for z in verbindung.execute(
            "SELECT id, kaltmiete, nebenkosten, ruecklage FROM mieter"
        ).fetchall()
    }

    mieter: dict[tuple, dict] = {}
    for p in posten:
        if p["position"] not in ("E_MIETE", "E_UMLAGEN"):
            continue
        schluessel = (p["mieter_id"], p["haus"])
        eintrag = mieter.setdefault(schluessel, {
            "mieter": p["mieter"] or "(ohne Mieterzuordnung)",
            "haus": p["haus"] or "(ohne Haus)",
            "monate": {},
            "kaltmiete": Decimal("0"),
            "umlagen": Decimal("0"),
            "summe": Decimal("0"),
            "soll_monat": (_summe_soll(soll[p["mieter_id"]])
                           if p["mieter_id"] in soll else Decimal("0")),
        })
        zahl_jahr = int(p["datum"][:4])
        if zahl_jahr < jahr:
            monat = 1
        elif zahl_jahr > jahr:
            monat = 12
        else:
            monat = int(p["datum"][5:7])
        eintrag["monate"][monat] = eintrag["monate"].get(
            monat, Decimal("0")) + p["angesetzt"]
        if p["position"] == "E_MIETE":
            eintrag["kaltmiete"] += p["angesetzt"]
        else:
            eintrag["umlagen"] += p["angesetzt"]
        eintrag["summe"] += p["angesetzt"]

    liste = sorted(mieter.values(), key=lambda e: (e["haus"], e["mieter"]))
    gesamt = sum((e["summe"] for e in liste), Decimal("0"))
    return {"jahr": jahr, "mieter": liste, "gesamt": gesamt}


def _summe_soll(zeile: sqlite3.Row) -> Decimal:
    """Summiert die vereinbarte Monatsmiete (Kalt + NK)."""
    gesamt = Decimal("0")
    for feld in ("kaltmiete", "nebenkosten"):
        try:
            gesamt += Decimal(str(zeile[feld]))
        except (ValueError, TypeError):
            pass
    return gesamt


def mieteinnahmen_html(daten: dict, haus_name: str) -> str:
    """Baut den Mieteinnahmen-Nachweis als HTML (Mieter × Monate)."""
    kopf = "".join(f"<th>{m}</th>" for m in _MONATE_KURZ)
    zeilen_html = ""
    for e in daten["mieter"]:
        zellen = ""
        for monat in range(1, 13):
            betrag = e["monate"].get(monat)
            if betrag is not None:
                zellen += (f"<td align='right'>"
                           f"{betrag_formatieren(betrag)}</td>")
            else:
                zellen += "<td align='center'>–</td>"
        zeilen_html += (
            f"<tr><td>{html.escape(e['mieter'])}</td>"
            f"<td>{html.escape(e['haus'])}</td>"
            f"{zellen}"
            f"<td align='right'><b>{betrag_formatieren(e['summe'])}</b></td>"
            f"</tr>"
        )

    return f"""
    <h2>Mieteinnahmen-Nachweis {daten['jahr']}</h2>
    <p><b>Haus:</b> {html.escape(haus_name)}<br>
    <b>Zeitraum:</b> 01.01.{daten['jahr']} – 31.12.{daten['jahr']}</p>
    <p>Beträge in Euro: tatsächliche Zahlungseingänge laut Buchungen
    (Kaltmiete + Nebenkosten-Vorauszahlungen, Zuflussprinzip;
    – = kein Zahlungseingang).</p>
    <table border='1' cellspacing='0' cellpadding='3' width='100%'>
      <tr><th>Mieter</th><th>Haus</th>{kopf}<th>Summe</th></tr>
      {zeilen_html}
      <tr><td colspan='14'></td>
      <td align='right'><b>{betrag_formatieren(daten['gesamt'])}</b></td></tr>
    </table>
    <p><i>Nachweis für die Anlage V (Einkünfte aus Vermietung und
    Verpachtung). Automatisch erstellt, bitte vor Abgabe prüfen.</i></p>
    """


def mieteinnahmen_pdf(
    verbindung: sqlite3.Connection, objekt_id: int | None, jahr: int,
    haus_name: str, ordner: Path | None = None,
) -> Path:
    """Erstellt den Mieteinnahmen-Nachweis eines Jahres als PDF."""
    daten = mieteinnahmen_daten(verbindung, objekt_id, jahr)
    ordner = ordner or exporte_verzeichnis()
    ordner.mkdir(parents=True, exist_ok=True)
    ziel = ordner / (
        f"Mieteinnahmen_{_dateiname_saeubern(haus_name)}_{jahr}.pdf"
    )
    html_nach_pdf(mieteinnahmen_html(daten, haus_name), ziel, quer=True)
    return ziel
