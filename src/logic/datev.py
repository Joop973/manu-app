"""DATEV-Export: Buchungsstapel im DATEV-Format (EXTF, Formatversion 13).

Aufbau nach der DATEV-Formatbeschreibung „Buchungsstapel“:

* Zeile 1: Kopfzeile mit 31 Feldern (Berater-, Mandantennummer,
  Wirtschaftsjahr, Sachkontenlänge, Zeitraum, Kontenrahmen …)
* Zeile 2: die 125 Spaltenüberschriften
* ab Zeile 3: eine Buchung je Zeile

Zeichensatz Windows-1252, Zeilenende CRLF, Trennzeichen Semikolon,
Texte in Anführungszeichen, Beträge ohne Vorzeichen mit Dezimalkomma,
Belegdatum als ``TTMM``.

Buchungslogik: ``Konto`` ist immer das Bankkonto. Geldeingang = Soll
(„S“), Geldausgang = Haben („H“); ``Gegenkonto`` ist das Sachkonto der
Kategorie. Wird eine Buchung nur anteilig angesetzt, geht der Rest auf
das Privatkonto. Die Kostenstelle (KOST1) trennt die Häuser.

Die vorgeschlagenen Sachkonten sind **Vorschläge ohne Gewähr** und vor
dem ersten Import mit dem Steuerberater abzustimmen (Export →
Einstellungen bzw. je Kategorie in den Stammdaten).
"""

from __future__ import annotations

import re
import sqlite3
import unicodedata
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from src.logic.steuer import POSITION_NACH_SCHLUESSEL, posten_laden
from src.utils.eingaben import ValidierungsFehler

SPALTEN = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz",
    "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto",
    "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum",
    "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext", "Postensperre",
    "Diverse Adressnummer", "Geschäftspartnerbank", "Sachverhalt",
    "Zinssperre", "Beleglink",
    *[f"Beleginfo - {teil} {n}" for n in range(1, 9)
      for teil in ("Art", "Inhalt")],
    "KOST1 - Kostenstelle", "KOST2 - Kostenstelle", "Kost-Menge",
    "EU-Land u. UStID (Bestimmung)", "EU-Steuersatz (Bestimmung)",
    "Abw. Versteuerungsart", "Sachverhalt L+L", "Funktionsergänzung L+L",
    "BU 49 Hauptfunktionstyp", "BU 49 Hauptfunktionsnummer",
    "BU 49 Funktionsergänzung",
    *[name for n in range(1, 21) for name in (
        f"Zusatzinformation - Art {n}", f"Zusatzinformation- Inhalt {n}")],
    "Stück", "Gewicht", "Zahlweise", "Forderungsart", "Veranlagungsjahr",
    "Zugeordnete Fälligkeit", "Skontotyp", "Auftragsnummer", "Buchungstyp",
    "USt-Schlüssel (Anzahlungen)", "EU-Land (Anzahlungen)",
    "Sachverhalt L+L (Anzahlungen)", "EU-Steuersatz (Anzahlungen)",
    "Erlöskonto (Anzahlungen)", "Herkunft-Kz", "Buchungs GUID", "KOST-Datum",
    "SEPA-Mandatsreferenz", "Skontosperre", "Gesellschaftername",
    "Beteiligtennummer", "Identifikationsnummer", "Zeichnernummer",
    "Postensperre bis", "Bezeichnung SoBil-Sachverhalt",
    "Kennzeichen SoBil-Buchung", "Festschreibung", "Leistungsdatum",
    "Datum Zuord. Steuerperiode", "Fälligkeit", "Generalumkehr (GU)",
    "Steuersatz", "Land", "Abrechnungsreferenz", "BVV-Position",
    "EU-Land u. UStID (Ursprung)", "EU-Steuersatz (Ursprung)",
    "Abw. Skontokonto",
]
assert len(SPALTEN) == 125

# Spaltenindizes (0-basiert) der verwendeten Felder.
_UMSATZ, _SH, _WKZ, _KONTO, _GEGENKONTO, _BU = 0, 1, 2, 6, 7, 8
_BELEGDATUM, _BELEGFELD1, _BUCHUNGSTEXT = 9, 10, 13
_BELEGINFO_ART1, _BELEGINFO_INHALT1 = 20, 21
_BELEGINFO_ART2, _BELEGINFO_INHALT2 = 22, 23
_KOST1 = 36

# --- Einstellungen ---------------------------------------------------------

E_BERATER = "datev_beraternummer"
E_MANDANT = "datev_mandantennummer"
E_SKR = "datev_kontenrahmen"
E_BANK = "datev_bankkonto"
E_PRIVAT = "datev_privatkonto"
E_NEUTRAL = "datev_neutralkonto"
E_KONTO_PREFIX = "datev_konto:"

# Vorschläge je Kontenrahmen (ohne Gewähr, mit Steuerberater abstimmen).
STANDARDKONTEN: dict[str, dict[str, str]] = {
    "03": {
        "bank": "1200", "privat": "1800", "neutral": "1360",
        "miete": "2750", "umlagen": "2750", "einnahme_sonstige": "2750",
        "wk_laufend": "2350", "wk_erhaltung": "4260",
        "wk_schuldzinsen": "2100", "wk_geldbeschaffung": "2100",
        "wk_sonstige": "2350", "herstellung": "1360", "privat_art": "1800",
        "ungeklaert": "1360",
    },
    "04": {
        "bank": "1800", "privat": "2100", "neutral": "1460",
        "miete": "4860", "umlagen": "4860", "einnahme_sonstige": "4860",
        "wk_laufend": "6350", "wk_erhaltung": "6335",
        "wk_schuldzinsen": "7300", "wk_geldbeschaffung": "7300",
        "wk_sonstige": "6350", "herstellung": "1460", "privat_art": "2100",
        "ungeklaert": "1460",
    },
}


def _einstellung(verbindung, schluessel, standard=""):
    zeile = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?", (schluessel,)
    ).fetchone()
    return zeile["wert"] if zeile and zeile["wert"] not in (None, "") \
        else standard


def einstellungen_laden(verbindung: sqlite3.Connection) -> dict:
    skr = _einstellung(verbindung, E_SKR, "03")
    vorschlag = STANDARDKONTEN.get(skr, STANDARDKONTEN["03"])
    konten = {
        art: _einstellung(verbindung, E_KONTO_PREFIX + art, vorschlag[art])
        for art in vorschlag
    }
    return {
        "berater": _einstellung(verbindung, E_BERATER),
        "mandant": _einstellung(verbindung, E_MANDANT),
        "skr": skr,
        "bank": _einstellung(verbindung, E_BANK, vorschlag["bank"]),
        "privat": _einstellung(verbindung, E_PRIVAT, vorschlag["privat"]),
        "neutral": _einstellung(verbindung, E_NEUTRAL, vorschlag["neutral"]),
        "konten": konten,
    }


def einstellungen_speichern(verbindung: sqlite3.Connection, werte: dict) -> None:
    """Speichert die DATEV-Einstellungen nach Prüfung."""
    berater = (werte.get("berater") or "").strip()
    mandant = (werte.get("mandant") or "").strip()
    if berater and (not berater.isdigit() or not 1001 <= int(berater)
                    <= 9999999):
        raise ValidierungsFehler(
            "Beraternummer: 4–7 Ziffern, mindestens 1001.")
    if mandant and (not mandant.isdigit() or not 1 <= int(mandant) <= 99999):
        raise ValidierungsFehler("Mandantennummer: 1–5 Ziffern.")
    skr = werte.get("skr") or "03"
    if skr not in STANDARDKONTEN:
        raise ValidierungsFehler("Kontenrahmen muss SKR03 oder SKR04 sein.")
    paare = [(E_BERATER, berater), (E_MANDANT, mandant), (E_SKR, skr)]
    for schluessel, feld in ((E_BANK, "bank"), (E_PRIVAT, "privat"),
                             (E_NEUTRAL, "neutral")):
        konto = (werte.get(feld) or "").strip()
        if konto and (not konto.isdigit() or len(konto) != 4):
            raise ValidierungsFehler(
                f"Konto „{konto}“: Sachkonten haben 4 Ziffern.")
        paare.append((schluessel, konto))
    for art, konto in (werte.get("konten") or {}).items():
        konto = (konto or "").strip()
        if konto and (not konto.isdigit() or len(konto) != 4):
            raise ValidierungsFehler(
                f"Konto „{konto}“: Sachkonten haben 4 Ziffern.")
        paare.append((E_KONTO_PREFIX + art, konto))
    for schluessel, wert in paare:
        verbindung.execute(
            "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
            "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
            (schluessel, wert),
        )
    verbindung.commit()


# --- Hilfen ------------------------------------------------------------------


def _text(wert: str, laenge: int) -> str:
    """Textfeld: ohne Steuerzeichen/Semikolon/Anführungszeichen, gekürzt."""
    wert = re.sub(r"[\r\n\t;]+", " ", wert or "").replace('"', "'")
    wert = re.sub(r"\s{2,}", " ", wert).strip()[:laenge]
    return f'"{wert}"'


def _betrag(wert: Decimal) -> str:
    return f"{abs(wert):.2f}".replace(".", ",")


def kostenstelle(haus_name: str | None, eingestellt: str | None) -> str:
    """KOST1: eingestellte Kostenstelle oder Kurzform des Hausnamens."""
    if eingestellt:
        return eingestellt[:36]
    if not haus_name:
        return ""
    text = (haus_name.replace("ß", "ss").replace("ä", "ae")
            .replace("ö", "oe").replace("ü", "ue").replace("Ä", "AE")
            .replace("Ö", "OE").replace("Ü", "UE"))
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore")
    return re.sub(r"[^A-Za-z0-9]", "", text.decode()).upper()[:36]


def _sachkonto(posten: dict, einst: dict) -> str:
    if posten.get("datev_konto"):
        return posten["datev_konto"]
    art = posten["steuer_art"]
    if art is None:
        return einst["konten"]["ungeklaert"]
    if art == "privat":
        return einst["konten"]["privat_art"]
    if art == "neutral":
        return einst["neutral"]
    return einst["konten"].get(art, einst["neutral"])


# --- Export ------------------------------------------------------------------


def buchungsstapel_zeilen(
    verbindung: sqlite3.Connection, jahr: int
) -> tuple[list[list[str]], list[str]]:
    """Erzeugt die Datenzeilen des Buchungsstapels und Hinweise."""
    einst = einstellungen_laden(verbindung)
    zeilen: list[list[str]] = []
    hinweise: list[str] = []
    for p in posten_laden(verbindung, jahr):
        kasse = p["kasse"]
        if kasse == 0:
            continue
        sh = "S" if kasse > 0 else "H"
        datum = p["datum"]
        tag, monat = datum[8:10], datum[5:7]
        vorsatz = ""
        if int(datum[:4]) != jahr:
            # Belegdatum muss im Stapelzeitraum liegen: auf Jahresanfang
            # bzw. -ende setzen und das echte Zahlungsdatum vermerken.
            tag, monat = ("01", "01") if int(datum[:4]) < jahr else ("31", "12")
            vorsatz = f"§11 Zahlg {datum[8:10]}.{datum[5:7]}.{datum[:4]} "
        position = (POSITION_NACH_SCHLUESSEL[p["position"]].bezeichnung
                    if p["position"] else (
                        "nicht in Anlage V (privat/neutral/AfA)"
                        if not p["ungeklaert"] else "UNGEKLÄRT"))
        text = f"{p['kategorie'] or ''}: {p['beschreibung']}".strip(": ")
        if p["ungeklaert"]:
            text = "UNGEKLÄRT " + text
            hinweise.append(
                f"{p['belegnr']}: Kategorie „{p['kategorie']}“ ohne "
                "steuerliche Zuordnung – auf Sammelkonto gebucht."
            )
        teile: list[tuple[Decimal, str, str]] = []
        gesamt = abs(kasse)
        if p["position"] and p["prozent"] != Decimal(100):
            anteil = abs(p["angesetzt"])
            rest = gesamt - anteil
            if anteil:
                teile.append((anteil, _sachkonto(p, einst),
                              f"{p['prozent'].normalize():f}%"))
            if rest:
                teile.append((rest, einst["privat"], "Privatanteil"))
        else:
            teile.append((gesamt, _sachkonto(p, einst), ""))
        for betrag, konto, text_zusatz in teile:
            felder = [""] * len(SPALTEN)
            felder[_UMSATZ] = _betrag(betrag)
            felder[_SH] = _text(sh, 1)
            felder[_WKZ] = _text("EUR", 3)
            felder[_KONTO] = einst["bank"]
            felder[_GEGENKONTO] = konto
            felder[_BU] = _text("", 4)
            felder[_BELEGDATUM] = f"{tag}{monat}"
            felder[_BELEGFELD1] = _text(p["belegnr"], 36)
            felder[_BUCHUNGSTEXT] = _text(vorsatz + text_zusatz.strip() + " "
                                          + text if text_zusatz else
                                          vorsatz + text, 60)
            felder[_BELEGINFO_ART1] = _text("Anlage V", 20)
            felder[_BELEGINFO_INHALT1] = _text(position, 210)
            if p["mieter"]:
                felder[_BELEGINFO_ART2] = _text("Mieter", 20)
                felder[_BELEGINFO_INHALT2] = _text(p["mieter"], 210)
            felder[_KOST1] = _text(kostenstelle(p["haus"], p["kostenstelle"]),
                                   36)
            zeilen.append(felder)
    return zeilen, hinweise


def buchungsstapel_schreiben(
    verbindung: sqlite3.Connection, jahr: int, ziel: Path
) -> tuple[Path, list[str]]:
    """Schreibt den Buchungsstapel eines Jahres als DATEV-CSV."""
    einst = einstellungen_laden(verbindung)
    if not einst["berater"] or not einst["mandant"]:
        raise ValidierungsFehler(
            "Für den DATEV-Export bitte zuerst Berater- und Mandantennummer "
            "eintragen (Export → Einstellungen). Beide Nummern bekommst du "
            "vom Steuerberater."
        )
    zeilen, hinweise = buchungsstapel_zeilen(verbindung, jahr)
    jetzt = datetime.now()
    erzeugt = jetzt.strftime("%Y%m%d%H%M%S") + f"{jetzt.microsecond // 1000:03d}"
    kopf = [
        '"EXTF"', "700", "21", '"Buchungsstapel"', "13", erzeugt, "",
        '"RE"', '"Manu-App"', '""', einst["berater"], einst["mandant"],
        f"{jahr}0101", "4", f"{jahr}0101", f"{jahr}1231",
        _text(f"Vermietung {jahr}", 30), '""', "1", "0", "0", '"EUR"', "",
        '""', "", "", _text(einst["skr"], 2), "", "", '""', '""',
    ]
    assert len(kopf) == 31
    inhalt = [";".join(kopf), ";".join(SPALTEN)]
    inhalt += [";".join(z) for z in zeilen]
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_bytes(("\r\n".join(inhalt) + "\r\n").encode(
        "cp1252", errors="replace"))
    if not zeilen:
        hinweise.append("Keine Buchungen im Jahr – Datei enthält nur den Kopf.")
    hinweise.append(
        "AfA und Investitionen sind keine Zahlungen und daher nicht im "
        "Buchungsstapel enthalten (siehe Anlage-V-Übersicht)."
    )
    return ziel, hinweise
