"""Lernsystem für den Kontoauszug-Import.

Normalisiert Empfänger-/Verwendungszwecktexte und ordnet anhand
gespeicherter Buchungsmuster automatisch Haus und Kategorie zu.
"""

from __future__ import annotations

import re
import sqlite3
from decimal import Decimal

from src.db import buchungen, einstellungen, muster, regeln, stammdaten

# Wörter, die bei der Mieter-/Haus-Erkennung ignoriert werden (zu unspezifisch).
_STOPWORTE = {
    "DER", "DIE", "DAS", "UND", "VON", "FUR", "FÜR", "MIT", "GMBH", "MBH",
    "MIETE", "MIETER", "HAUS", "WOHNUNG", "DAUERAUFTRAGSGUTSCHR",
    "GUTSCHRIFT", "UBERWEISUNG", "ÜBERWEISUNG", "SEPA", "EUR",
    "BASISLASTSCHRIFT", "LASTSCHRIFT", "HERR", "FRAU",
}
# Mindest-Wortlänge, damit ein Token für die Erkennung zählt.
_MIN_TOKEN = 3

# Sentinel: unterscheidet „kein Argument übergeben" (globale Einstellung
# nutzen) von „ausdrücklich None übergeben" (Konto ohne Standard-Haus).
_UNSET = object()

# Maximale Länge des gespeicherten Erkennungstextes.
_ERKENNUNG_LAENGE = 40
# Ab dieser relativen Betragsabweichung gilt ein Treffer als unsicher.
ABWEICHUNG_GRENZE = Decimal("0.30")

# Rechtsformen, die beim Normalisieren entfernt werden (längste zuerst).
_RECHTSFORMEN = [
    "GMBH & CO. KG", "GMBH & CO KG", "GMBH", "MBH", "UG", "AG",
    "KG", "OHG", "GBR", "SE", "E.K.", "E. K.",
]

# Schlüsselwörter, nach denen Referenz-/Rechnungsnummern folgen.
_REFERENZ = re.compile(
    r"\b(RECHNUNG|RECHNUNGS-?NR|RG|RE|NR|REF|REFERENZ|KD|KUNDE|"
    r"KUNDEN-?NR|VERTRAG|VERTRAGS-?NR|BELEG|MANDAT)\b\.?\s*:?\s*\S*\d\S*",
    re.IGNORECASE,
)


def normalisieren(text: str) -> str:
    """Normalisiert einen Empfängertext für den Mustervergleich.

    Entfernt Datumsangaben, Referenz-/Rechnungsnummern, lange Ziffern-
    folgen und Rechtsformen, vereinheitlicht Groß-/Kleinschreibung und
    Leerzeichen.
    """
    if not text:
        return ""
    bearbeitet = text.upper()
    # Datumsangaben entfernen
    bearbeitet = re.sub(r"\b\d{1,2}\.\d{1,2}\.\d{2,4}\b", " ", bearbeitet)
    # Referenz- und Rechnungsnummern entfernen
    bearbeitet = _REFERENZ.sub(" ", bearbeitet)
    # Lange Ziffernfolgen (IBAN-Reste, Nummern) entfernen
    bearbeitet = re.sub(r"\b[A-Z]{0,2}\d[\d ]{4,}\d\b", " ", bearbeitet)
    bearbeitet = re.sub(r"\b\d{4,}\b", " ", bearbeitet)
    # Rechtsformen entfernen
    for rechtsform in _RECHTSFORMEN:
        bearbeitet = bearbeitet.replace(rechtsform, " ")
    # Nur Buchstaben und Leerzeichen behalten
    bearbeitet = re.sub(r"[^A-ZÄÖÜß ]", " ", bearbeitet)
    # Mehrfach-Leerzeichen zusammenfassen
    return re.sub(r"\s+", " ", bearbeitet).strip()


def erkennungstext_bilden(normalisierter_text: str) -> str:
    """Bildet aus dem normalisierten Text einen kompakten Erkennungstext.

    Verwendet den Anfang des Textes (dort steht meist der Empfänger) und
    schneidet an einer Wortgrenze ab.
    """
    if len(normalisierter_text) <= _ERKENNUNG_LAENGE:
        return normalisierter_text
    kurz = normalisierter_text[:_ERKENNUNG_LAENGE]
    if " " in kurz:
        kurz = kurz.rsplit(" ", 1)[0]
    return kurz


def _durchschnitt_fuer_muster(
    verbindung: sqlite3.Connection, erkennungstext: str
) -> Decimal | None:
    """Mittelt die Beträge bisheriger Buchungen desselben Musters.

    Eine Buchung zählt als „ähnlich", wenn der Erkennungstext im
    normalisierten Verwendungszweck enthalten ist.
    """
    if not erkennungstext:
        return None
    zeilen = verbindung.execute(
        "SELECT betrag, beschreibung FROM buchungen"
    ).fetchall()
    betraege = []
    for zeile in zeilen:
        if not zeile["beschreibung"]:
            continue
        if erkennungstext in normalisieren(zeile["beschreibung"]):
            try:
                betraege.append(abs(Decimal(zeile["betrag"])))
            except (ValueError, TypeError):
                continue
    if not betraege:
        return None
    return sum(betraege, Decimal("0")) / Decimal(len(betraege))


# Stichwort-Heuristik: ordnet einer normalisierten Empfänger-Zeile eine
# Kategorie zu, *bevor* irgendetwas gelernt wurde. Wirkt nur, wenn keine
# Regel und kein Muster getroffen haben.
#
# Reihenfolge wichtig: spezifischere Stichwörter zuerst, damit z. B.
# „STADTWERKE" nicht ungewollt vor „WERKE" trifft.
_KATEGORIE_HEURISTIK: list[tuple[tuple[str, ...], str]] = [
    # Kontoabschluss / Bankgebühren
    (("ABSCHLUSS", "KONTOFUEHRUNG", "KONTOFÜHRUNG", "ENTGELT", "AUSLAGEN"),
     "Kontoabschluss"),
    # Steuern
    (("FINANZAMT", "LANDESHAUPTKASSE", "EINK ST", "STEUER", "FINANZKASSE"),
     "Finanzamt"),
    # Versicherungen
    (("HUK", "ALLIANZ", "BRANDKASSE", "VERSICHERUNG", "AXA", "PROVINZIAL",
      "DEVK", "GOTHAER", "ERGO", "DEBEKA", "GENERALI", "VHV", "ZURICH"),
     "Versicherung"),
    # Gemeinde / Grundsteuer
    (("GRUNDBESITZ", "GRUNDSTEUER", "GEMEINDE", "STADTKASSE"),
     "Gemeinde/Grundbesitz"),
    # Abfall / Müll
    (("ABFALLWIRTSCHAFT", "ABFALL", "MUELL", "MÜLL", "AWB"),
     "Müll"),
    # Schornstein
    (("SCHORNSTEINFEGER", "KAMINKEHRER"),
     "Schornsteinfeger"),
    # Wasser
    (("WASSERWERK", "WASSERVERBAND", "STADTENTWAESSERUNG", "ABWASSER"),
     "Wasser"),
    # Energie
    (("STADTWERKE",),
     "Gas"),  # Default Gas; nutzer kann auf Strom umstellen
    (("STROM", "ENERGIE", "ELEKTRIZITAET"),
     "Strom"),
    (("GAS", "ERDGAS"),
     "Gas"),
    # Medien / Telefon
    (("VODAFONE", "TELEKOM", "1UND1", "1&1", "O2", "TELEFONICA"),
     "Vodafone"),
    (("GEZ", "RUNDFUNK", "ARD ZDF", "ARDZDF", "BEITRAGSSERVICE"),
     "GEZ"),
    # Erbpacht
    (("ERBPACHT", "ERBBAUZINS"),
     "Erbpacht"),
]


def _heuristik_kategorie_id(
    verbindung: sqlite3.Connection, normalisiert: str
) -> int | None:
    """Sucht eine Kategorie über Stichwörter im normalisierten Text."""
    for stichworte, kategorie_name in _KATEGORIE_HEURISTIK:
        if any(s in normalisiert for s in stichworte):
            zeile = verbindung.execute(
                "SELECT id FROM kategorien WHERE name = ? AND typ = 'ausgabe' "
                "AND aktiv = 1",
                (kategorie_name,),
            ).fetchone()
            if zeile is not None:
                return zeile["id"]
    return None


def _tokens(normalisiert: str) -> set[str]:
    """Zerlegt einen normalisierten Text in aussagekräftige Wörter."""
    return {
        wort for wort in normalisiert.split()
        if len(wort) >= _MIN_TOKEN and wort not in _STOPWORTE
    }


def mieter_erkennen(
    verbindung: sqlite3.Connection, normalisiert: str
) -> sqlite3.Row | None:
    """Erkennt einen bekannten Mieter am Absender-/Verwendungszwecktext.

    Vergleicht die Wörter des Mieternamens mit den Wörtern der Buchung.
    Es gewinnt der Mieter mit der höchsten Wortüberdeckung; verlangt wird
    mindestens ein gemeinsames aussagekräftiges Wort und, bei mehrteiligen
    Namen, mindestens die Hälfte der Namensbestandteile.
    """
    text_tokens = _tokens(normalisiert)
    if not text_tokens:
        return None
    bester: sqlite3.Row | None = None
    beste_treffer = 0
    for mieter in stammdaten.mieter_alle_laden(verbindung):
        name_tokens = _tokens(normalisieren(mieter["name"]))
        if not name_tokens:
            continue
        gemeinsam = name_tokens & text_tokens
        if not gemeinsam:
            continue
        # Bei mehrteiligen Namen mindestens die Hälfte der Wörter treffen.
        if len(gemeinsam) < (len(name_tokens) + 1) // 2:
            continue
        if len(gemeinsam) > beste_treffer:
            beste_treffer = len(gemeinsam)
            bester = mieter
    return bester


def haus_aus_text(
    verbindung: sqlite3.Connection, normalisiert: str
) -> int | None:
    """Erkennt ein Haus am Namen oder Erkennungstext im Verwendungszweck."""
    text_tokens = _tokens(normalisiert)
    if not text_tokens:
        return None
    bester_id: int | None = None
    beste_treffer = 0
    for haus in stammdaten.objekte_laden(verbindung):
        quellen = [haus["name"]]
        try:
            if haus["erkennungstext"]:
                quellen.append(haus["erkennungstext"])
        except (KeyError, IndexError):
            pass
        haus_tokens: set[str] = set()
        for quelle in quellen:
            haus_tokens |= _tokens(normalisieren(quelle))
        gemeinsam = haus_tokens & text_tokens
        if gemeinsam and len(gemeinsam) > beste_treffer:
            beste_treffer = len(gemeinsam)
            bester_id = haus["id"]
    return bester_id


def _standard_haus_id(verbindung: sqlite3.Connection) -> int | None:
    """Liefert das eingestellte Standard-Haus für den Import (oder None)."""
    wert = einstellungen.einstellung_lesen(
        verbindung, einstellungen.SCHLUESSEL_STANDARD_HAUS
    )
    if not wert:
        return None
    try:
        return int(wert)
    except (ValueError, TypeError):
        return None


def klassifizieren(
    verbindung: sqlite3.Connection,
    datum: str,
    betrag: Decimal,
    text: str,
    standard_haus: int | None | object = _UNSET,
) -> dict:
    """Klassifiziert eine importierte Buchungszeile möglichst vollständig.

    Reihenfolge der Zuordnung:
      1. benutzerdefinierte Regel
      2. gelerntes Muster
      3. Mieter-Erkennung am Text (ergänzt Mieter + dessen Haus)
      4. Haus-Erkennung am Text, sonst Standard-Haus
      5. Kategorie: Stichwort-Heuristik; Einnahme eines erkannten
         Mieters → Kaltmiete; sonst „Rahmen"-Kategorie aus dem
         Empfängernamen bzw. „Sonstiges"

    ``standard_haus`` überschreibt das Standard-Haus für diese Zeile:
    wird es übergeben (auch ``None``), gilt es statt der globalen
    Einstellung. So kann der Import je Konto ein eigenes Standard-Haus
    setzen — oder mit ``None`` bewusst keins (mehrere Häuser teilen das
    Konto). Ohne Angabe greift die globale Standard-Haus-Einstellung.

    ``status``:
    * ``auto``     — Haus **und** Kategorie stehen fest
    * ``unsicher`` — Treffer mit auffälliger Betragsabweichung
    * ``neu``      — Haus oder Kategorie fehlt noch
    """
    normalisiert = normalisieren(text)
    kandidat = {
        "datum": datum,
        "betrag": betrag,
        "text": text,
        "norm": normalisiert,
        "objekt_id": None,
        "kategorie_id": None,
        "mieter_id": None,
        # Freitext-Kategorie, die beim Übernehmen angelegt wird (Rahmen).
        "kategorie_name": None,
        "kategorie_typ": "einnahme" if betrag > 0 else "ausgabe",
        "status": "neu",
        "dublette": buchungen.buchung_existiert(verbindung, datum, betrag),
    }

    # 1) Benutzerdefinierte Regel hat Vorrang.
    regel = regeln.regel_finden(verbindung, normalisiert)
    if regel is not None:
        kandidat["objekt_id"] = regel["objekt_id"]
        kandidat["kategorie_id"] = regel["kategorie_id"]
        kandidat["mieter_id"] = regel["mieter_id"]

    # 2) Gelerntes Muster ergänzt, was die Regel offen lässt.
    treffer = muster.muster_finden(verbindung, normalisiert)
    if treffer is not None:
        if kandidat["objekt_id"] is None:
            kandidat["objekt_id"] = treffer["objekt_id"]
        if kandidat["kategorie_id"] is None:
            kandidat["kategorie_id"] = treffer["kategorie_id"]
        if kandidat["mieter_id"] is None:
            kandidat["mieter_id"] = treffer["mieter_id"]
        schnitt = _durchschnitt_fuer_muster(
            verbindung, treffer["erkennungstext"]
        )
        if schnitt and schnitt > 0:
            abweichung = abs(abs(betrag) - schnitt) / schnitt
            if abweichung > ABWEICHUNG_GRENZE:
                kandidat["status"] = "unsicher"

    # 3) Mieter am Text erkennen (auch als Quelle für das Haus).
    if kandidat["mieter_id"] is None:
        mieter = mieter_erkennen(verbindung, normalisiert)
        if mieter is not None:
            kandidat["mieter_id"] = mieter["id"]
            if kandidat["objekt_id"] is None:
                kandidat["objekt_id"] = mieter["objekt_id"]

    # 4) Haus bestimmen: Text-Erkennung, sonst Standard-Haus.
    if kandidat["objekt_id"] is None:
        kandidat["objekt_id"] = haus_aus_text(verbindung, normalisiert)
    if kandidat["objekt_id"] is None:
        if standard_haus is _UNSET:
            kandidat["objekt_id"] = _standard_haus_id(verbindung)
        else:
            # Konto-spezifische Vorgabe (auch None = bewusst kein Haus).
            kandidat["objekt_id"] = standard_haus

    # 5) Kategorie bestimmen.
    if kandidat["kategorie_id"] is None:
        if betrag > 0 and kandidat["mieter_id"] is not None:
            # Eingang eines erkannten Mieters → Kaltmiete
            kandidat["kategorie_name"] = "Kaltmiete"
            kandidat["kategorie_typ"] = "einnahme"
        elif betrag < 0:
            vorschlag = _heuristik_kategorie_id(verbindung, normalisiert)
            if vorschlag is not None:
                kandidat["kategorie_id"] = vorschlag
            else:
                # Rahmen: neue Kategorie aus dem Empfängernamen
                kandidat["kategorie_name"] = _rahmen_kategorie_name(
                    normalisiert
                )
                kandidat["kategorie_typ"] = "ausgabe"
        else:
            kandidat["kategorie_name"] = "Sonstiges"
            kandidat["kategorie_typ"] = "einnahme" if betrag > 0 else "ausgabe"

    # Status: auto, wenn Haus feststeht und Kategorie feststeht bzw. als
    # Rahmen-Kategorie automatisch angelegt wird.
    hat_kategorie = (
        kandidat["kategorie_id"] is not None
        or kandidat["kategorie_name"] is not None
    )
    if (kandidat["status"] != "unsicher"
            and kandidat["objekt_id"] is not None and hat_kategorie):
        kandidat["status"] = "auto"
    return kandidat


def aehnliche_buchungen(
    verbindung: sqlite3.Connection,
    beschreibung: str,
    ausser_id: int | None = None,
) -> list[int]:
    """Findet Buchungen mit demselben Empfänger-Erkennungstext.

    Grundlage für das nachträgliche Umlernen: Wird eine Buchung
    korrigiert, können ähnliche Buchungen (gleicher Empfänger) die neue
    Zuordnung übernehmen. Liefert die IDs der ähnlichen Buchungen.
    """
    erkennung = erkennungstext_bilden(normalisieren(beschreibung))
    if not erkennung:
        return []
    ids: list[int] = []
    for zeile in verbindung.execute(
        "SELECT id, beschreibung FROM buchungen"
    ).fetchall():
        if ausser_id is not None and zeile["id"] == ausser_id:
            continue
        if erkennung in normalisieren(zeile["beschreibung"] or ""):
            ids.append(zeile["id"])
    return ids


def _rahmen_kategorie_name(normalisiert: str) -> str:
    """Bildet aus dem Empfängertext einen kurzen Kategorienamen (Rahmen).

    Nimmt die ersten aussagekräftigen Wörter des Empfängers und macht
    daraus einen lesbaren Titel (z. B. „Handwerker Meyer").
    """
    worte = [w for w in normalisiert.split()
             if len(w) >= _MIN_TOKEN and w not in _STOPWORTE]
    if not worte:
        return "Sonstiges"
    titel = " ".join(worte[:3]).title()
    return titel
