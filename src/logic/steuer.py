"""Steuerliche Auswertung der Vermietung (Anlage V) und Prüfbericht.

Grundprinzipien (aus Sicht der Steuerberatung):

* **Zufluss-/Abflussprinzip (§ 11 EStG):** maßgeblich ist das Jahr der
  Zahlung. Je Buchung kann ein abweichendes Steuerjahr gesetzt werden
  (10-Tage-Regel für regelmäßig wiederkehrende Zahlungen um den
  Jahreswechsel). Der Prüfbericht schlägt Kandidaten vor.
* **Vorzeichen:** Ein Betrag ist immer *in Richtung der Kategorie*
  gespeichert. Positiv = Normalfall (Einnahme bei Einnahme-Kategorie,
  Ausgabe bei Ausgabe-Kategorie). Negativ = Gegenbuchung, z. B. eine
  Erstattung des Versorgers (mindert die Kosten) oder die Rückzahlung
  eines Nebenkosten-Guthabens an den Mieter (mindert die Umlagen).
* **Steuerliche Art je Kategorie:** legt fest, in welche Position der
  Anlage V die Buchung fällt. Private Zahlungen (z. B. Einkommensteuer)
  und neutrale Umbuchungen (eigenes Geld, Kaution) bleiben außen vor.
  Ausgaben ohne geklärte Art werden **nicht** angesetzt und im
  Prüfbericht gemeldet (vorsichtiges Vorgehen).
* **Prozentuale Anrechnung:** Rangfolge Buchung → Haus × Kategorie →
  Kategorie → 100 %. Der nicht angesetzte Rest wird ausgewiesen.
* **Cent-genau:** sämtliche Beträge als ``Decimal``, kaufmännisch
  gerundet auf den Cent.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from src.logic.afa import cent, lineare_afa_plan
from src.utils.eingaben import betrag_formatieren

_NULL = Decimal("0")
_HUNDERT = Decimal("100")


# =========================================================================
# Steuerliche Arten und Positionen der Anlage V
# =========================================================================


@dataclass(frozen=True)
class SteuerArt:
    bezeichnung: str
    # Position in der Anlage V (None = nicht in der Anlage V).
    position: str | None
    # Kurzerklärung für die Oberfläche.
    hinweis: str = ""


# Position "WK_LAUFEND" wird je nach Merkmal „umlagefähig“ der Kategorie
# zu "WK_UMGELEGT" oder "WK_NICHT_UMGELEGT" aufgelöst.
STEUER_ARTEN: dict[str, SteuerArt] = {
    "miete": SteuerArt(
        "Mieteinnahme (Kaltmiete, ohne Umlagen)", "E_MIETE",
        "Kaltmiete der vermieteten Wohnungen/WG-Zimmer."),
    "umlagen": SteuerArt(
        "Umlagen / Nebenkosten-Vorauszahlung", "E_UMLAGEN",
        "Vorauszahlungen und Nachzahlungen der Mieter; Rückzahlungen "
        "an Mieter als Gegenbuchung (negativ)."),
    "einnahme_sonstige": SteuerArt(
        "Sonstige Einnahme aus Vermietung", "E_SONSTIGE",
        "z. B. Garage/Stellplatz, Zuschüsse, Schadenersatz."),
    "wk_laufend": SteuerArt(
        "Laufende Kosten (Werbungskosten)", "WK_LAUFEND",
        "Grundsteuer, Versicherung, Wasser, Müll, Heizung, Strom, "
        "Internet/GEZ für Mieter, Bankgebühren, Erbbauzins …"),
    "wk_erhaltung": SteuerArt(
        "Erhaltungsaufwand (Reparatur, sofort abziehbar)", "WK_ERHALTUNG",
        "Reparaturen und Instandhaltung, die den Zustand erhalten."),
    "wk_schuldzinsen": SteuerArt(
        "Schuldzinsen (ohne Tilgung)", "WK_SCHULDZINSEN",
        "Nur der Zinsanteil eines Darlehens für das Haus."),
    "wk_geldbeschaffung": SteuerArt(
        "Geldbeschaffungskosten", "WK_GELDBESCHAFFUNG",
        "z. B. Bearbeitungsgebühr, Grundschuld-Eintragung."),
    "wk_sonstige": SteuerArt(
        "Sonstige Werbungskosten", "WK_SONSTIGE",
        "Fahrtkosten, Porto, Inserate, Steuerberatung (V+V-Anteil)."),
    "herstellung": SteuerArt(
        "Herstellungs-/Anschaffungskosten (nur über AfA)", None,
        "Nicht sofort abziehbar — als Investition „Herstellung“ "
        "erfassen, dann wirkt sie über die AfA."),
    "privat": SteuerArt(
        "Privat – steuerlich nicht abziehbar", None,
        "z. B. Einkommensteuer, private Ausgaben."),
    "neutral": SteuerArt(
        "Neutral – Umbuchung / durchlaufend", None,
        "Umbuchung zwischen eigenen Konten (Rücklage), Mietkaution."),
}

# Anzeigereihenfolge der steuerlichen Arten in Auswahlfeldern.
STEUER_ARTEN_REIHENFOLGE = list(STEUER_ARTEN)

UNGEKLAERT_TEXT = "— noch nicht festgelegt —"


@dataclass(frozen=True)
class Position:
    schluessel: str
    bezeichnung: str
    gruppe: str            # "einnahme" | "wk" | "summe"
    standard_zeile: str    # Vorbelegung der Zeilennummer (Vordruck 2024)


# Zeilennummern: Vorbelegung nach Vordruck/Anleitung 2024. Sie ändern
# sich erfahrungsgemäß von Jahr zu Jahr und sind daher in der App
# einstellbar (Export → Einstellungen). Der Vordruck 2026 erscheint
# erst Anfang 2027 — vor dem Übertrag in ELSTER abgleichen!
POSITIONEN: list[Position] = [
    Position("E_MIETE", "Mieteinnahmen für Wohnungen (ohne Umlagen)",
             "einnahme", "9"),
    Position("E_UMLAGEN", "Umlagen, verrechnet mit Erstattungen",
             "einnahme", "13"),
    Position("E_SONSTIGE", "Sonstige Einnahmen", "einnahme", ""),
    Position("E_SUMME", "Summe der Einnahmen", "summe", ""),
    Position("WK_AFA", "AfA Gebäude inkl. nachträglicher "
             "Herstellungskosten", "wk", "33"),
    Position("WK_SCHULDZINSEN", "Schuldzinsen", "wk", ""),
    Position("WK_GELDBESCHAFFUNG", "Geldbeschaffungskosten", "wk", ""),
    Position("WK_ERHALTUNG", "Erhaltungsaufwendungen (sofort bzw. "
             "Jahresanteil § 82b EStDV)", "wk", ""),
    Position("WK_UMGELEGT", "Umgelegte Kosten (Betriebskosten, auf "
             "Mieter verteilt)", "wk", "73–75"),
    Position("WK_NICHT_UMGELEGT", "Nicht umgelegte Kosten", "wk", "76–78"),
    Position("WK_SONSTIGE", "Sonstige Werbungskosten", "wk", ""),
    Position("WK_SUMME", "Summe der Werbungskosten", "summe", "83"),
    Position("UEBERSCHUSS", "Einkünfte (Überschuss / Verlust)", "summe", ""),
]
POSITION_NACH_SCHLUESSEL = {p.schluessel: p for p in POSITIONEN}

_ZEILE_PREFIX = "anlage_v_zeile:"
ZEILEN_STAND = "Vorbelegung nach Vordruck 2024 – vor Übertrag mit dem " \
               "amtlichen Vordruck des Steuerjahres abgleichen"


def zeilennummer(verbindung: sqlite3.Connection, schluessel: str) -> str:
    """Liefert die eingestellte Zeilennummer einer Position."""
    zeile = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?",
        (_ZEILE_PREFIX + schluessel,),
    ).fetchone()
    if zeile is not None and zeile["wert"] is not None:
        return zeile["wert"]
    position = POSITION_NACH_SCHLUESSEL.get(schluessel)
    return position.standard_zeile if position else ""


def zeilennummer_setzen(
    verbindung: sqlite3.Connection, schluessel: str, wert: str
) -> None:
    verbindung.execute(
        "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (_ZEILE_PREFIX + schluessel, (wert or "").strip()),
    )
    verbindung.commit()


def steuer_art_text(art: str | None) -> str:
    if art is None:
        return UNGEKLAERT_TEXT
    eintrag = STEUER_ARTEN.get(art)
    return eintrag.bezeichnung if eintrag else art


# =========================================================================
# Hilfsfunktionen
# =========================================================================


def dezimal(wert, standard: Decimal | None = None) -> Decimal | None:
    """Liest einen gespeicherten Zahlentext tolerant als Decimal."""
    if wert is None or str(wert).strip() == "":
        return standard
    try:
        return Decimal(str(wert).replace(",", "."))
    except (InvalidOperation, ValueError):
        return standard


def prozent_parsen(text: str | None) -> Decimal | None:
    """Wandelt eine Prozent-Eingabe (z. B. „50“, „33,5 %“) in Decimal.

    Leere Eingabe → ``None`` (= Voreinstellung verwenden). Erlaubt sind
    Werte von 0 bis 100.
    """
    from src.utils.eingaben import ValidierungsFehler

    roh = (text or "").replace("%", "").strip()
    if not roh:
        return None
    wert = dezimal(roh)
    if wert is None:
        raise ValidierungsFehler(f"„{text}“ ist kein gültiger Prozentwert.")
    if wert < 0 or wert > 100:
        raise ValidierungsFehler("Der Anteil muss zwischen 0 und 100 % liegen.")
    return wert.quantize(Decimal("0.01"))


def prozent_formatieren(wert: Decimal | None) -> str:
    if wert is None:
        return ""
    text = f"{wert.normalize():f}".replace(".", ",")
    return f"{text} %"


def betrag_fuer_kategorie(kontobetrag: Decimal, kategorie_typ: str) -> Decimal:
    """Rechnet einen Konto-Betrag (+ Eingang / − Ausgang) in die
    gespeicherte Form „in Richtung der Kategorie“ um.

    Eingang auf Einnahme-Kategorie → positiv, Ausgang auf Ausgabe-
    Kategorie → positiv; in allen anderen Fällen negativ (Gegenbuchung,
    z. B. Erstattung des Versorgers auf „Wasser“).
    """
    betrag = abs(kontobetrag)
    eingang = kontobetrag > 0
    if (kategorie_typ == "einnahme") == eingang:
        return betrag
    return -betrag


def kassenbetrag(gespeichert: Decimal, kategorie_typ: str | None) -> Decimal:
    """Zahlungswirkung einer Buchung: + Zufluss, − Abfluss."""
    return gespeichert if kategorie_typ == "einnahme" else -gespeichert


def zahlungsrichtung_aus_text(text: str | None) -> str | None:
    """Erkennt aus dem Vorgangstext der Bank, ob Geld ein- oder ausging.

    Liefert ``"eingang"``, ``"ausgang"`` oder ``None`` (unklar). Nur der
    Anfang des Textes (Vorgangsart) wird betrachtet.
    """
    kopf = (text or "").lower()[:40]
    if not kopf:
        return None
    if "gutschr" in kopf or kopf.startswith(("rücklastschrift",
                                              "ruecklastschrift",
                                              "erstattung")):
        return "eingang"
    if kopf.startswith(("basislastschrift", "lastschrift",
                        "firmenlastschrift", "überweisung", "ueberweisung",
                        "online-überweisung", "dauerauftrag",
                        "abschluss", "kartenzahlung", "gaa ",
                        "auszahlung")):
        return "ausgang"
    return None


def effektives_jahr(datum: str, steuerjahr) -> int:
    if steuerjahr not in (None, ""):
        return int(steuerjahr)
    return int(datum[:4])


# =========================================================================
# Buchungen mit steuerlicher Einordnung laden
# =========================================================================

_POSTEN_SQL = (
    "SELECT b.id, b.datum, b.betrag, b.objekt_id, b.kategorie_id, "
    "b.mieter_id, b.beschreibung, b.beleg_pfad, b.quelle, "
    "b.steuer_prozent AS b_prozent, b.steuerjahr, "
    "o.name AS haus, o.kostenstelle, "
    "k.name AS kategorie, k.typ, k.steuer_art, k.umlagefaehig, "
    "k.steuer_prozent AS k_prozent, k.datev_konto, "
    "a.prozent AS h_prozent, m.name AS mieter "
    "FROM buchungen b "
    "LEFT JOIN objekte o ON o.id = b.objekt_id "
    "LEFT JOIN kategorien k ON k.id = b.kategorie_id "
    "LEFT JOIN mieter m ON m.id = b.mieter_id "
    "LEFT JOIN kategorie_haus_anteil a "
    "  ON a.objekt_id = b.objekt_id AND a.kategorie_id = b.kategorie_id "
)


def anteil_aufloesen(
    buchung_prozent, haus_prozent, kategorie_prozent
) -> tuple[Decimal, str]:
    """Bestimmt den wirksamen Prozentsatz und seine Herkunft."""
    for wert, quelle in (
        (buchung_prozent, "Buchung"),
        (haus_prozent, "Haus"),
        (kategorie_prozent, "Kategorie"),
    ):
        zahl = dezimal(wert)
        if zahl is not None:
            return zahl, quelle
    return _HUNDERT, "Standard"


def _position_fuer(art: str | None, typ: str | None, umlagefaehig) -> str | None:
    if art is None:
        # Ungeklärte Einnahmen werden vorsichtshalber als sonstige
        # Einnahme angesetzt, ungeklärte Ausgaben nicht.
        return "E_SONSTIGE" if typ == "einnahme" else None
    eintrag = STEUER_ARTEN.get(art)
    if eintrag is None or eintrag.position is None:
        return None
    if eintrag.position == "WK_LAUFEND":
        return "WK_UMGELEGT" if umlagefaehig else "WK_NICHT_UMGELEGT"
    return eintrag.position


def posten_aus_zeile(zeile: sqlite3.Row) -> dict | None:
    """Wandelt eine Buchungszeile in einen steuerlich bewerteten Posten."""
    betrag = dezimal(zeile["betrag"])
    if betrag is None:
        return None
    typ = zeile["typ"]
    kasse = kassenbetrag(betrag, typ)
    position = _position_fuer(zeile["steuer_art"], typ, zeile["umlagefaehig"])
    prozent, quelle = anteil_aufloesen(
        zeile["b_prozent"], zeile["h_prozent"], zeile["k_prozent"]
    )
    gruppe = POSITION_NACH_SCHLUESSEL[position].gruppe if position else None
    # Wert in Richtung der Position: Einnahmen = Zufluss positiv,
    # Werbungskosten = Abfluss positiv.
    if gruppe == "einnahme":
        wert = kasse
    elif gruppe == "wk":
        wert = -kasse
    else:
        wert = betrag
    angesetzt = cent(wert * prozent / _HUNDERT) if position else _NULL
    return {
        "id": zeile["id"],
        "belegnr": f"B{zeile['id']:05d}",
        "datum": zeile["datum"],
        "steuerjahr": effektives_jahr(zeile["datum"], zeile["steuerjahr"]),
        "steuerjahr_abweichend": zeile["steuerjahr"] is not None,
        "betrag": betrag,
        "kasse": kasse,
        "objekt_id": zeile["objekt_id"],
        "haus": zeile["haus"],
        "kostenstelle": zeile["kostenstelle"],
        "kategorie_id": zeile["kategorie_id"],
        "kategorie": zeile["kategorie"],
        "typ": typ,
        "steuer_art": zeile["steuer_art"],
        "umlagefaehig": bool(zeile["umlagefaehig"]),
        "datev_konto": zeile["datev_konto"],
        "position": position,
        "ungeklaert": zeile["steuer_art"] is None,
        "prozent": prozent,
        "prozent_quelle": quelle,
        "wert": wert,
        "angesetzt": angesetzt,
        "nicht_angesetzt": (wert - angesetzt) if position else wert,
        "mieter_id": zeile["mieter_id"],
        "mieter": zeile["mieter"],
        "beschreibung": zeile["beschreibung"] or "",
        "beleg_pfad": zeile["beleg_pfad"],
        "quelle": zeile["quelle"],
    }


def posten_laden(
    verbindung: sqlite3.Connection, jahr: int, objekt_id=...
) -> list[dict]:
    """Lädt alle Buchungen, die steuerlich in ``jahr`` fallen.

    ``objekt_id``: weglassen = alle Buchungen; ``None`` = nur Buchungen
    ohne Haus; Zahl = nur dieses Haus.
    """
    sql = _POSTEN_SQL + (
        "WHERE ((b.steuerjahr IS NULL AND substr(b.datum, 1, 4) = ?) "
        "   OR b.steuerjahr = ?)"
    )
    parameter: list = [f"{jahr:04d}", jahr]
    if objekt_id is None:
        sql += " AND b.objekt_id IS NULL"
    elif objekt_id is not ...:
        sql += " AND b.objekt_id = ?"
        parameter.append(objekt_id)
    sql += " ORDER BY b.datum, b.id"
    ergebnis = []
    for zeile in verbindung.execute(sql, parameter).fetchall():
        posten = posten_aus_zeile(zeile)
        if posten is not None:
            ergebnis.append(posten)
    return ergebnis


# =========================================================================
# Gebäude-AfA
# =========================================================================


def gebaeude_afa(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> dict | None:
    """AfA des Gebäudes laut Haus-Stammdaten (None = nicht hinterlegt)."""
    haus = verbindung.execute(
        "SELECT afa_bemessung, afa_beginn, afa_satz FROM objekte WHERE id = ?",
        (objekt_id,),
    ).fetchone()
    if haus is None:
        return None
    bemessung = dezimal(haus["afa_bemessung"])
    satz = dezimal(haus["afa_satz"])
    try:
        beginn = date.fromisoformat((haus["afa_beginn"] or "")[:10])
    except ValueError:
        beginn = None
    if not bemessung or not satz or beginn is None:
        return None
    plan = lineare_afa_plan(bemessung, beginn, satz)
    bisher = sum((b for j, b in plan.items() if j < jahr), _NULL)
    return {
        "bemessung": bemessung,
        "beginn": beginn.isoformat(),
        "satz": satz,
        "betrag": plan.get(jahr, _NULL),
        "restwert": bemessung - bisher - plan.get(jahr, _NULL),
    }


# =========================================================================
# Auswertung je Haus
# =========================================================================


def auswertung(
    verbindung: sqlite3.Connection, objekt_id: int, jahr: int
) -> dict:
    """Berechnet alle Anlage-V-Positionen eines Hauses für ein Jahr."""
    from src.db import investitionen

    haus = verbindung.execute(
        "SELECT id, name, adresse, gesamtflaeche, kostenstelle "
        "FROM objekte WHERE id = ?",
        (objekt_id,),
    ).fetchone()
    if haus is None:
        raise ValueError("Haus nicht gefunden.")

    positionen = {
        p.schluessel: {"gesamt": _NULL, "angesetzt": _NULL}
        for p in POSITIONEN
    }
    posten = posten_laden(verbindung, jahr, objekt_id)
    angesetzt: list[dict] = []
    nicht_beruecksichtigt: list[dict] = []
    for p in posten:
        if p["position"] is None:
            nicht_beruecksichtigt.append(p)
            continue
        positionen[p["position"]]["gesamt"] += p["wert"]
        positionen[p["position"]]["angesetzt"] += p["angesetzt"]
        angesetzt.append(p)

    # Investitionen: Erhaltung (inkl. § 82b) und AfA nachträglicher
    # Herstellungskosten.
    inv = investitionen.afa_im_jahr(verbindung, objekt_id, jahr)
    positionen["WK_ERHALTUNG"]["gesamt"] += inv["erhaltung"]
    positionen["WK_ERHALTUNG"]["angesetzt"] += inv["erhaltung"]
    positionen["WK_AFA"]["gesamt"] += inv["afa"]
    positionen["WK_AFA"]["angesetzt"] += inv["afa"]

    afa_gebaeude = gebaeude_afa(verbindung, objekt_id, jahr)
    if afa_gebaeude is not None:
        positionen["WK_AFA"]["gesamt"] += afa_gebaeude["betrag"]
        positionen["WK_AFA"]["angesetzt"] += afa_gebaeude["betrag"]

    for spalte in ("gesamt", "angesetzt"):
        positionen["E_SUMME"][spalte] = sum(
            (positionen[p.schluessel][spalte] for p in POSITIONEN
             if p.gruppe == "einnahme"), _NULL
        )
        positionen["WK_SUMME"][spalte] = sum(
            (positionen[p.schluessel][spalte] for p in POSITIONEN
             if p.gruppe == "wk"), _NULL
        )
        positionen["UEBERSCHUSS"][spalte] = (
            positionen["E_SUMME"][spalte] - positionen["WK_SUMME"][spalte]
        )

    return {
        "objekt_id": objekt_id,
        "haus": haus["name"],
        "adresse": haus["adresse"] or "",
        "jahr": jahr,
        "positionen": positionen,
        "posten": angesetzt,
        "nicht_beruecksichtigt": nicht_beruecksichtigt,
        "investitionen": inv["positionen"],
        "afa_gebaeude": afa_gebaeude,
        "einkuenfte": positionen["UEBERSCHUSS"]["angesetzt"],
    }


def haeuser_mit_daten(verbindung: sqlite3.Connection, jahr: int) -> list:
    """Alle aktiven Häuser plus inaktive, die im Jahr Buchungen haben."""
    from src.db import stammdaten

    ergebnis = []
    for haus in stammdaten.objekte_laden(verbindung):
        if haus["aktiv"] or posten_laden(verbindung, jahr, haus["id"]):
            ergebnis.append(haus)
    return ergebnis


# =========================================================================
# Prüfbericht
# =========================================================================

FEHLER = "fehler"
WARNUNG = "warnung"
INFO = "info"
STUFEN_TEXT = {FEHLER: "Fehler", WARNUNG: "Prüfen", INFO: "Hinweis"}

# Steuerliche Arten mit regelmäßig wiederkehrenden Zahlungen (für die
# 10-Tage-Regel des § 11 EStG).
_WIEDERKEHREND = {"miete", "umlagen", "wk_laufend", "wk_schuldzinsen"}


def _hinweis(stufe, bereich, text, buchung_ids=None, aktion=None,
             wert=None, objekt_id=None) -> dict:
    return {
        "stufe": stufe,
        "bereich": bereich,
        "text": text,
        "buchung_ids": list(buchung_ids or []),
        "aktion": aktion,     # "vorzeichen" | "steuerjahr" | None
        "wert": wert,         # z. B. Ziel-Steuerjahr
        "objekt_id": objekt_id,
    }


def _datum(text: str) -> date | None:
    try:
        return date.fromisoformat(text[:10])
    except (TypeError, ValueError):
        return None


def _kurz(posten: dict) -> str:
    d = posten["datum"]
    return (f"{d[8:10]}.{d[5:7]}.{d[:4]} · "
            f"{betrag_formatieren(posten['betrag'])} € · "
            f"{posten['kategorie'] or 'ohne Kategorie'} · "
            f"{(posten['beschreibung'] or '')[:60]}")


def pruefen(verbindung: sqlite3.Connection, jahr: int) -> list[dict]:
    """Prüft die Daten eines Steuerjahres auf Fehler und Auffälligkeiten.

    Liefert Hinweise, sortiert nach Schwere (Fehler → Prüfen → Hinweis).
    """
    from src.db import investitionen

    hinweise: list[dict] = []
    alle = posten_laden(verbindung, jahr)

    # 1) Kategorien ohne steuerliche Zuordnung
    ungeklaert: dict[str, list[dict]] = {}
    for p in alle:
        if p["ungeklaert"]:
            ungeklaert.setdefault(p["kategorie"] or "(ohne Kategorie)",
                                  []).append(p)
    for name, liste in sorted(ungeklaert.items()):
        summe = sum((p["betrag"] for p in liste), _NULL)
        typ = liste[0]["typ"]
        folge = ("wird vorsichtshalber als sonstige Einnahme angesetzt"
                 if typ == "einnahme"
                 else "wird NICHT als Werbungskosten angesetzt")
        hinweise.append(_hinweis(
            WARNUNG if typ == "einnahme" else FEHLER, "Kategorie",
            f"Kategorie „{name}“ hat keine steuerliche Zuordnung "
            f"({len(liste)} Buchung(en), {betrag_formatieren(summe)} €) – "
            f"{folge}. Bitte in Stammdaten → Kategorien festlegen.",
            [p["id"] for p in liste],
        ))

    # 2) Buchungen ohne Haus
    ohne_haus = [p for p in alle if p["objekt_id"] is None
                 and p["steuer_art"] not in ("privat", "neutral")]
    if ohne_haus:
        hinweise.append(_hinweis(
            FEHLER, "Haus",
            f"{len(ohne_haus)} Buchung(en) ohne Haus – sie fehlen in jeder "
            "Anlage V. Bitte Haus zuordnen oder aufteilen.",
            [p["id"] for p in ohne_haus],
        ))

    # 3) Zahlungsrichtung passt nicht zur Kategorie (Erstattungen)
    for p in alle:
        if p["quelle"] != "import" or p["betrag"] <= 0:
            continue
        richtung = zahlungsrichtung_aus_text(p["beschreibung"])
        if richtung == "eingang" and p["typ"] == "ausgabe":
            hinweise.append(_hinweis(
                WARNUNG, "Vorzeichen",
                "Geldeingang auf Ausgabe-Kategorie – vermutlich eine "
                "Erstattung, wird aber als Kosten gezählt: " + _kurz(p),
                [p["id"]], aktion="vorzeichen",
            ))
        elif richtung == "ausgang" and p["typ"] == "einnahme":
            hinweise.append(_hinweis(
                WARNUNG, "Vorzeichen",
                "Geldausgang auf Einnahme-Kategorie – vermutlich eine "
                "Rückzahlung, wird aber als Einnahme gezählt: " + _kurz(p),
                [p["id"]], aktion="vorzeichen",
            ))

    # 4) 10-Tage-Regel (§ 11 Abs. 1 Satz 2 EStG)
    jahresbeginn = date(jahr, 1, 1)
    jahresende = date(jahr, 12, 31)
    zeitraum_sql = (
        _POSTEN_SQL + "WHERE b.steuerjahr IS NULL AND b.datum BETWEEN ? AND ?"
    )
    for von, bis, ziel, text in (
        (date(jahr - 1, 12, 22), date(jahr - 1, 12, 31), jahr,
         f"kurz vor Jahresbeginn gezahlt – gehört sie wirtschaftlich zu {jahr}?"),
        (date(jahr, 12, 22), jahresende, jahr + 1,
         f"Ende Dezember gezahlt – Vorauszahlung für {jahr + 1}?"),
        (date(jahr + 1, 1, 1), date(jahr + 1, 1, 10), jahr,
         f"Anfang Januar gezahlt – gehört sie wirtschaftlich zu {jahr}?"),
        (jahresbeginn, date(jahr, 1, 10), jahr - 1,
         f"Anfang Januar gezahlt – gehört sie wirtschaftlich zu {jahr - 1}?"),
    ):
        for zeile in verbindung.execute(
            zeitraum_sql, (von.isoformat(), bis.isoformat())
        ).fetchall():
            p = posten_aus_zeile(zeile)
            if p is None or p["steuer_art"] not in _WIEDERKEHREND:
                continue
            hinweise.append(_hinweis(
                INFO, "§ 11 EStG",
                f"Regelmäßige Zahlung {text} Nur umstellen, wenn sie für "
                f"{ziel} fällig war (10-Tage-Regel): " + _kurz(p),
                [p["id"]], aktion="steuerjahr", wert=ziel,
            ))

    # 5) Doppelt erfasste Mieten (Checkliste + Kontoauszug)
    doppelt = verbindung.execute(
        "SELECT a.id AS a_id, b.id AS b_id FROM buchungen a "
        "JOIN buchungen b ON a.mieter_id = b.mieter_id "
        " AND a.kategorie_id = b.kategorie_id "
        " AND substr(a.datum, 1, 7) = substr(b.datum, 1, 7) "
        "WHERE a.quelle LIKE 'mietzahlung:%' AND b.quelle = 'import' "
        "AND substr(a.datum, 1, 4) = ?",
        (f"{jahr:04d}",),
    ).fetchall()
    for zeile in doppelt:
        hinweise.append(_hinweis(
            FEHLER, "Doppelt",
            "Miete vermutlich doppelt erfasst (Häkchen in der Mieterliste "
            "UND Kontoauszug-Import im selben Monat). Häkchen-Buchung "
            "zurücknehmen.",
            [zeile["a_id"], zeile["b_id"]],
        ))

    # 6) Herstellungskosten ohne Investition / Erhaltung doppelt
    invest = investitionen.investitionen_laden(verbindung)
    for p in alle:
        if p["steuer_art"] != "herstellung" or p["objekt_id"] is None:
            continue
        d = _datum(p["datum"])
        passend = any(
            i["objekt_id"] == p["objekt_id"]
            and abs(dezimal(i["betrag"], _NULL) - abs(p["betrag"]))
            <= Decimal("0.01")
            and d is not None and _datum(i["datum"]) is not None
            and abs((_datum(i["datum"]) - d).days) <= 120
            for i in invest
        )
        if not passend:
            hinweise.append(_hinweis(
                WARNUNG, "AfA",
                "Herstellungs-/Anschaffungskosten ohne passende Investition "
                "– wirkt so steuerlich gar nicht. Unter Stammdaten → "
                "Investitionen als „Herstellung“ erfassen: " + _kurz(p),
                [p["id"]],
            ))
    for i in invest:
        if i["typ"] != "erhaltung" or not (i["datum"] or "").startswith(
                f"{jahr:04d}"):
            continue
        betrag = dezimal(i["betrag"], _NULL)
        gleiche = [
            p for p in alle
            if p["objekt_id"] == i["objekt_id"] and p["position"]
            and p["position"].startswith("WK_")
            and abs(abs(p["betrag"]) - betrag) <= Decimal("0.01")
        ]
        if gleiche:
            hinweise.append(_hinweis(
                FEHLER, "Doppelt",
                f"Investition „{i['beschreibung']}“ "
                f"({betrag_formatieren(betrag)} €) ist zusätzlich als "
                "Buchung mit Werbungskosten erfasst – sonst doppelt "
                "abgezogen. Die Bank-Buchung auf „Modernisierung/"
                "Anschaffung (AfA)“ oder neutral stellen oder die "
                "Investition löschen.",
                [p["id"] for p in gleiche],
            ))

    # 7) Je Haus: Gebäude-AfA, 15-%-Grenze, fehlende Belege
    for haus in haeuser_mit_daten(verbindung, jahr):
        posten_haus = [p for p in alle if p["objekt_id"] == haus["id"]]
        if not posten_haus:
            continue
        afa = gebaeude_afa(verbindung, haus["id"], jahr)
        if afa is None:
            hinweise.append(_hinweis(
                INFO, "AfA",
                f"{haus['name']}: Gebäude-AfA nicht hinterlegt. Werte "
                "(Gebäudeanteil der Anschaffungskosten, Beginn, Satz) aus "
                "Kaufvertrag oder Vorjahres-Erklärung beim Steuerberater "
                "erfragen und unter Stammdaten → Häuser → Steuer-Daten "
                "eintragen.",
                objekt_id=haus["id"],
            ))
        else:
            beginn = date.fromisoformat(afa["beginn"])
            ende_frist = date(beginn.year + 3, beginn.month, 1) - timedelta(
                days=1)
            if beginn <= jahresende and ende_frist >= jahresbeginn:
                erhaltung = sum(
                    (p["wert"] for p in posten_laden(verbindung, jahr,
                                                     haus["id"])
                     if p["position"] == "WK_ERHALTUNG"), _NULL)
                for vorjahr in range(beginn.year, jahr):
                    erhaltung += sum(
                        (p["wert"] for p in posten_laden(
                            verbindung, vorjahr, haus["id"])
                         if p["position"] == "WK_ERHALTUNG"), _NULL)
                grenze = cent(afa["bemessung"] * Decimal("0.15"))
                if erhaltung > grenze:
                    hinweise.append(_hinweis(
                        FEHLER, "AfA",
                        f"{haus['name']}: Instandsetzungen in den ersten 3 "
                        f"Jahren nach Anschaffung "
                        f"({betrag_formatieren(erhaltung)} €) übersteigen "
                        f"15 % der Gebäude-Anschaffungskosten "
                        f"({betrag_formatieren(grenze)} €) – anschaffungsnahe "
                        "Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG): nicht "
                        "sofort abziehbar, nur über AfA. Mit Steuerberater "
                        "klären (Grenze gilt netto ohne Umsatzsteuer).",
                        objekt_id=haus["id"],
                    ))
        ohne_beleg = [p for p in posten_haus
                      if p["position"] and p["position"].startswith("WK_")
                      and not p["beleg_pfad"]
                      and p["steuer_art"] != "wk_laufend"]
        if ohne_beleg:
            hinweise.append(_hinweis(
                INFO, "Belege",
                f"{haus['name']}: {len(ohne_beleg)} Reparatur-/sonstige "
                "Werbungskosten-Buchung(en) ohne Beleg. Rechnungen sollten "
                "auf Nachfrage des Finanzamts vorgelegt werden können.",
                [p["id"] for p in ohne_beleg], objekt_id=haus["id"],
            ))

    # 8) Abweichende Anteile (zur Information des Steuerberaters)
    teilweise = [p for p in alle if p["position"] and p["prozent"] != _HUNDERT]
    if teilweise:
        hinweise.append(_hinweis(
            INFO, "Anteil",
            f"{len(teilweise)} Buchung(en) werden nur anteilig angesetzt "
            "(Prozentsatz ≠ 100 %). Details im Einzelnachweis.",
            [p["id"] for p in teilweise],
        ))

    # 9) Buchungen in der Zukunft
    heute = date.today().isoformat()
    zukunft = [p for p in alle if p["datum"] > heute]
    if zukunft:
        hinweise.append(_hinweis(
            WARNUNG, "Datum",
            f"{len(zukunft)} Buchung(en) liegen in der Zukunft – Datum "
            "prüfen.",
            [p["id"] for p in zukunft],
        ))

    # 10) Rücklage in den Mieter-Stammdaten
    for m in verbindung.execute(
        "SELECT name, ruecklage FROM mieter WHERE ruecklage NOT IN ('0', "
        "'0.00', '') AND ruecklage IS NOT NULL"
    ).fetchall():
        if dezimal(m["ruecklage"], _NULL) > 0:
            hinweise.append(_hinweis(
                INFO, "Mieter",
                f"Mieter „{m['name']}“ hat eine monatliche „Rücklage“ "
                "eingetragen. Rücklage gilt als Umbuchung eigenen Geldes und "
                "zählt nicht als Mieteinnahme. Zahlt der Mieter den Betrag "
                "tatsächlich, gehört er zur Kaltmiete.",
            ))

    reihenfolge = {FEHLER: 0, WARNUNG: 1, INFO: 2}
    hinweise.sort(key=lambda h: (reihenfolge[h["stufe"]], h["bereich"]))
    return hinweise


# =========================================================================
# Änderungen aus dem Prüfbericht heraus
# =========================================================================


def vorzeichen_umkehren(verbindung: sqlite3.Connection, buchung_id: int) -> None:
    """Dreht eine Buchung zur Gegenbuchung um (z. B. Erstattung)."""
    from src.db import buchungen

    zeile = verbindung.execute(
        "SELECT betrag FROM buchungen WHERE id = ?", (buchung_id,)
    ).fetchone()
    if zeile is None:
        return
    buchungen.buchung_felder_setzen(
        verbindung, buchung_id, betrag=str(-dezimal(zeile["betrag"], _NULL))
    )


def steuerjahr_setzen(
    verbindung: sqlite3.Connection, buchung_id: int, steuerjahr: int | None
) -> None:
    from src.db import buchungen

    zeile = verbindung.execute(
        "SELECT datum FROM buchungen WHERE id = ?", (buchung_id,)
    ).fetchone()
    if zeile is None:
        return
    if steuerjahr is not None and int(zeile["datum"][:4]) == steuerjahr:
        steuerjahr = None
    buchungen.buchung_felder_setzen(
        verbindung, buchung_id, steuerjahr=steuerjahr
    )
