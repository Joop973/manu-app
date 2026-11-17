"""Datenzugriff für Buchungen und die Jahres-Auswertung des Dashboards.

Alle Geldbeträge werden als TEXT (Decimal-Darstellung) gespeichert und
beim Auswerten als ``Decimal`` zurückgelesen.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from src.db import aktionen
from src.utils.eingaben import ValidierungsFehler


def _buchung_als_dict(zeile: sqlite3.Row | None) -> dict | None:
    """Wandelt eine Buchungs-Zeile in ein JSON-fähiges Dictionary."""
    if zeile is None:
        return None
    return {
        "id": zeile["id"], "datum": zeile["datum"], "betrag": zeile["betrag"],
        "objekt_id": zeile["objekt_id"], "kategorie_id": zeile["kategorie_id"],
        "mieter_id": zeile["mieter_id"], "beschreibung": zeile["beschreibung"],
        "beleg_pfad": zeile["beleg_pfad"], "quelle": zeile["quelle"],
        "steuer_prozent": zeile["steuer_prozent"],
        "steuerjahr": zeile["steuerjahr"],
    }


def _buchung_lesen(
    verbindung: sqlite3.Connection, buchung_id: int
) -> sqlite3.Row | None:
    return verbindung.execute(
        "SELECT id, datum, betrag, objekt_id, kategorie_id, mieter_id, "
        "beschreibung, beleg_pfad, quelle, steuer_prozent, steuerjahr "
        "FROM buchungen WHERE id = ?",
        (buchung_id,),
    ).fetchone()


def buchungen_laden(
    verbindung: sqlite3.Connection,
    objekt_id: int | None = None,
    kategorie_id: int | None = None,
    mieter_id: int | None = None,
    monat: int | None = None,
    jahr: int | None = None,
    beleg: bool | None = None,
    suchtext: str | None = None,
) -> list[sqlite3.Row]:
    """Lädt Buchungen, optional gefiltert.

    ``beleg=True`` liefert nur Buchungen mit Beleg, ``beleg=False`` nur
    solche ohne Beleg, ``None`` schaltet den Belegfilter ab. ``suchtext``
    filtert über Beschreibung, Haus-, Kategorie- und Mietername.
    """
    sql = (
        "SELECT b.id, b.datum, b.betrag, b.objekt_id, b.kategorie_id, "
        "b.mieter_id, b.beschreibung, b.beleg_pfad, b.quelle, "
        "b.steuer_prozent, b.steuerjahr, "
        "o.name AS objekt_name, k.name AS kategorie_name, k.typ AS kategorie_typ, "
        "m.name AS mieter_name "
        "FROM buchungen b "
        "LEFT JOIN objekte o ON o.id = b.objekt_id "
        "LEFT JOIN kategorien k ON k.id = b.kategorie_id "
        "LEFT JOIN mieter m ON m.id = b.mieter_id "
        "WHERE 1 = 1"
    )
    parameter: list = []
    if objekt_id is not None:
        sql += " AND b.objekt_id = ?"
        parameter.append(objekt_id)
    if kategorie_id is not None:
        sql += " AND b.kategorie_id = ?"
        parameter.append(kategorie_id)
    if jahr is not None:
        sql += " AND substr(b.datum, 1, 4) = ?"
        parameter.append(f"{jahr:04d}")
    if monat is not None:
        sql += " AND substr(b.datum, 6, 2) = ?"
        parameter.append(f"{monat:02d}")
    if mieter_id is not None:
        sql += " AND b.mieter_id = ?"
        parameter.append(mieter_id)
    if beleg is True:
        sql += " AND b.beleg_pfad IS NOT NULL AND b.beleg_pfad != ''"
    elif beleg is False:
        sql += " AND (b.beleg_pfad IS NULL OR b.beleg_pfad = '')"
    if suchtext:
        like = f"%{suchtext.strip().lower()}%"
        sql += (
            " AND (LOWER(IFNULL(b.beschreibung, '')) LIKE ?"
            "  OR LOWER(IFNULL(o.name, ''))         LIKE ?"
            "  OR LOWER(IFNULL(k.name, ''))         LIKE ?"
            "  OR LOWER(IFNULL(m.name, ''))         LIKE ?"
            "  OR b.beleg_pfad IN (SELECT beleg_pfad FROM beleg_texte"
            "      WHERE LOWER(IFNULL(text, '')) LIKE ?))"
        )
        parameter.extend([like, like, like, like, like])
    sql += " ORDER BY b.datum DESC, b.id DESC"
    return verbindung.execute(sql, parameter).fetchall()


def import_monate_uebersicht(
    verbindung: sqlite3.Connection, jahr: int
) -> dict[int, int]:
    """Liefert je Monat des Jahres die Zahl der Import-Buchungen."""
    zeilen = verbindung.execute(
        "SELECT CAST(substr(datum, 6, 2) AS INTEGER) AS monat, COUNT(*) AS n "
        "FROM buchungen "
        "WHERE substr(datum, 1, 4) = ? AND quelle = 'import' "
        "GROUP BY monat",
        (f"{jahr:04d}",),
    ).fetchall()
    ergebnis = {m: 0 for m in range(1, 13)}
    for zeile in zeilen:
        ergebnis[int(zeile["monat"])] = int(zeile["n"])
    return ergebnis


def buchung_existiert(
    verbindung: sqlite3.Connection, datum: str, betrag: Decimal
) -> bool:
    """Prüft, ob bereits eine Buchung mit gleichem Datum und Betrag existiert.

    Dient der Dubletten-Warnung beim Import. Verglichen wird der Betrag
    ohne Vorzeichen, weil Gegenbuchungen (Erstattungen) negativ
    gespeichert sind. Aufgeteilte Mieten (Kaltmiete + Nebenkosten) gelten
    über ihre Summe als vorhanden.
    """
    ziel = abs(Decimal(betrag))
    zeilen = verbindung.execute(
        "SELECT betrag, beschreibung FROM buchungen WHERE datum = ?",
        (datum,),
    ).fetchall()
    gruppen: dict[str, Decimal] = {}
    for zeile in zeilen:
        try:
            wert = abs(Decimal(zeile["betrag"]))
        except (ValueError, TypeError, ArithmeticError):
            continue
        if wert == ziel:
            return True
        text = (zeile["beschreibung"] or "").split(" [Anteil ")[0]
        gruppen[text] = gruppen.get(text, Decimal("0")) + wert
    return any(summe == ziel for summe in gruppen.values())


def buchung_anlegen(
    verbindung: sqlite3.Connection,
    datum: str,
    betrag: Decimal,
    objekt_id: int,
    kategorie_id: int,
    beschreibung: str,
    beleg_pfad: str | None,
    quelle: str,
    mieter_id: int | None = None,
    steuer_prozent: Decimal | None = None,
    steuerjahr: int | None = None,
    commit: bool = True,
) -> int:
    """Legt eine neue Buchung an und liefert deren ID.

    ``betrag`` ist in Richtung der Kategorie anzugeben: positiv im
    Normalfall, negativ für Gegenbuchungen (z. B. Erstattungen).
    """
    if not datum:
        raise ValidierungsFehler("Bitte ein Datum angeben.")
    cursor = verbindung.execute(
        "INSERT INTO buchungen "
        "(datum, betrag, objekt_id, kategorie_id, mieter_id, beschreibung, "
        "beleg_pfad, quelle, steuer_prozent, steuerjahr) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (datum, str(betrag), objekt_id, kategorie_id, mieter_id,
         beschreibung, beleg_pfad, quelle,
         None if steuer_prozent is None else str(steuer_prozent),
         steuerjahr),
    )
    neue_id = cursor.lastrowid
    aktionen.aktion_protokollieren(
        verbindung, aktionen.ART_ANLEGEN, "buchungen", neue_id,
        zustand_neu=_buchung_als_dict(_buchung_lesen(verbindung, neue_id)),
    )
    if commit:
        verbindung.commit()
    return neue_id


def buchung_aktualisieren(
    verbindung: sqlite3.Connection,
    buchung_id: int,
    datum: str,
    betrag: Decimal,
    objekt_id: int,
    kategorie_id: int,
    beschreibung: str,
    beleg_pfad: str | None,
    mieter_id: int | None = None,
) -> None:
    """Aktualisiert eine bestehende Buchung."""
    if not datum:
        raise ValidierungsFehler("Bitte ein Datum angeben.")
    vorher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    verbindung.execute(
        "UPDATE buchungen SET datum = ?, betrag = ?, objekt_id = ?, "
        "kategorie_id = ?, mieter_id = ?, beschreibung = ?, beleg_pfad = ? "
        "WHERE id = ?",
        (datum, str(betrag), objekt_id, kategorie_id, mieter_id,
         beschreibung, beleg_pfad, buchung_id),
    )
    nachher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    aktionen.aktion_protokollieren(
        verbindung, aktionen.ART_AENDERN, "buchungen", buchung_id,
        zustand_alt=vorher, zustand_neu=nachher,
    )
    verbindung.commit()


def _kategorie_typ(
    verbindung: sqlite3.Connection, kategorie_id: int | None
) -> str | None:
    if kategorie_id is None:
        return None
    zeile = verbindung.execute(
        "SELECT typ FROM kategorien WHERE id = ?", (kategorie_id,)
    ).fetchone()
    return zeile["typ"] if zeile else None


def _betrag_bei_typwechsel(
    verbindung: sqlite3.Connection, vorher: dict, neue_kategorie_id
) -> str | None:
    """Neuer gespeicherter Betrag, wenn die Kategorie den Typ wechselt.

    Beträge sind in Richtung der Kategorie gespeichert. Wechselt eine
    Buchung von einer Einnahme- auf eine Ausgabe-Kategorie (oder
    umgekehrt), muss das Vorzeichen umgedreht werden, damit die
    tatsächliche Zahlungsrichtung (Geldeingang/-ausgang) erhalten bleibt.
    Liefert ``None``, wenn keine Änderung nötig ist.
    """
    alt = _kategorie_typ(verbindung, vorher.get("kategorie_id"))
    neu = _kategorie_typ(verbindung, neue_kategorie_id)
    if alt is None or neu is None or alt == neu:
        return None
    try:
        return str(-Decimal(vorher["betrag"]))
    except (ValueError, TypeError, ArithmeticError):
        return None


# Felder, die über ``buchung_felder_setzen`` geändert werden dürfen.
_AENDERBARE_FELDER = {
    "datum", "betrag", "objekt_id", "kategorie_id", "mieter_id",
    "beschreibung", "beleg_pfad", "steuer_prozent", "steuerjahr",
}


def buchung_felder_setzen(
    verbindung: sqlite3.Connection, buchung_id: int, **felder
) -> None:
    """Ändert einzelne Felder einer Buchung (mit Eintrag im Aktions-Log).

    Beispiel: ``buchung_felder_setzen(v, 7, steuerjahr=2026)``.
    """
    unbekannt = set(felder) - _AENDERBARE_FELDER
    if unbekannt:
        raise ValueError(f"Unbekannte Felder: {', '.join(sorted(unbekannt))}")
    if not felder:
        return
    vorher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    if vorher is None:
        return
    if "kategorie_id" in felder and "betrag" not in felder:
        gedreht = _betrag_bei_typwechsel(
            verbindung, vorher, felder["kategorie_id"]
        )
        if gedreht is not None:
            felder["betrag"] = gedreht
    werte = []
    for name, wert in felder.items():
        if isinstance(wert, Decimal):
            wert = str(wert)
        werte.append(wert)
    setzen = ", ".join(f"{name} = ?" for name in felder)
    verbindung.execute(
        f"UPDATE buchungen SET {setzen} WHERE id = ?", (*werte, buchung_id)
    )
    nachher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    aktionen.aktion_protokollieren(
        verbindung, aktionen.ART_AENDERN, "buchungen", buchung_id,
        zustand_alt=vorher, zustand_neu=nachher,
    )
    verbindung.commit()


def zuordnung_setzen(
    verbindung: sqlite3.Connection,
    buchung_id: int,
    objekt_id: int | None,
    kategorie_id: int | None,
    mieter_id: int | None,
) -> None:
    """Ändert nur die Zuordnung (Haus/Kategorie/Mieter) einer Buchung.

    Für das nachträgliche Umlernen: ähnliche Buchungen übernehmen die
    korrigierte Zuordnung, alle übrigen Felder bleiben unverändert
    (wechselt der Kategorie-Typ, wird nur das Vorzeichen angepasst, damit
    die Zahlungsrichtung erhalten bleibt).
    Wird im Aktions-Log als Änderung protokolliert.
    """
    vorher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    if vorher is None:
        return
    gedreht = _betrag_bei_typwechsel(verbindung, vorher, kategorie_id)
    verbindung.execute(
        "UPDATE buchungen SET objekt_id = ?, kategorie_id = ?, mieter_id = ?, "
        "betrag = ? WHERE id = ?",
        (objekt_id, kategorie_id, mieter_id,
         gedreht if gedreht is not None else vorher["betrag"], buchung_id),
    )
    nachher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    aktionen.aktion_protokollieren(
        verbindung, aktionen.ART_AENDERN, "buchungen", buchung_id,
        zustand_alt=vorher, zustand_neu=nachher,
    )
    verbindung.commit()


def buchung_loeschen(verbindung: sqlite3.Connection, buchung_id: int) -> None:
    """Löscht eine Buchung."""
    vorher = _buchung_als_dict(_buchung_lesen(verbindung, buchung_id))
    verbindung.execute("DELETE FROM buchungen WHERE id = ?", (buchung_id,))
    if vorher is not None:
        aktionen.aktion_protokollieren(
            verbindung, aktionen.ART_LOESCHEN, "buchungen", buchung_id,
            zustand_alt=vorher,
        )
    verbindung.commit()


def buchung_beleg_setzen(
    verbindung: sqlite3.Connection, buchung_id: int, beleg_pfad: str
) -> None:
    """Hinterlegt den Belegpfad einer bestehenden Buchung."""
    verbindung.execute(
        "UPDATE buchungen SET beleg_pfad = ? WHERE id = ?",
        (beleg_pfad, buchung_id),
    )
    verbindung.commit()


def jahre_laden(verbindung: sqlite3.Connection) -> list[int]:
    """Liefert alle Jahre, für die Buchungen existieren (absteigend)."""
    zeilen = verbindung.execute(
        "SELECT DISTINCT substr(datum, 1, 4) AS jahr FROM buchungen "
        "ORDER BY jahr DESC"
    ).fetchall()
    return [int(z["jahr"]) for z in zeilen if z["jahr"]]


# Frühestes Jahr, das in Auswahlfeldern angeboten wird.
ERSTES_AUSWAHLJAHR = 2024


def auswaehlbare_jahre(verbindung: sqlite3.Connection) -> list[int]:
    """Liefert alle in der Oberfläche auswählbaren Jahre (absteigend).

    Beginnt stets bei ``ERSTES_AUSWAHLJAHR`` und reicht mindestens bis
    zum kommenden Kalenderjahr; vorhandene DB-Jahre werden zusätzlich
    aufgenommen, falls sie außerhalb dieses Bereichs liegen.
    """
    from datetime import date

    db_jahre = jahre_laden(verbindung)
    max_jahr = max([date.today().year + 1] + db_jahre)
    min_jahr = min([ERSTES_AUSWAHLJAHR] + db_jahre)
    return list(range(max_jahr, min_jahr - 1, -1))


def jahres_auswertung(
    verbindung: sqlite3.Connection, jahr: int
) -> dict[int, dict]:
    """Aggregiert Einnahmen und Ausgaben eines Jahres je Haus.

    Liefert ein Dictionary ``{objekt_id: {...}}`` mit Jahressummen und
    Monatssummen für Einnahmen und Ausgaben.
    """
    zeilen = verbindung.execute(
        "SELECT b.objekt_id AS oid, substr(b.datum, 6, 2) AS monat, "
        "b.betrag AS betrag, k.typ AS typ "
        "FROM buchungen b "
        "LEFT JOIN kategorien k ON k.id = b.kategorie_id "
        "WHERE substr(b.datum, 1, 4) = ?",
        (f"{jahr:04d}",),
    ).fetchall()

    ergebnis: dict[int, dict] = {}
    for zeile in zeilen:
        if zeile["typ"] not in ("einnahme", "ausgabe"):
            continue
        if zeile["oid"] is None:
            continue
        eintrag = ergebnis.setdefault(
            zeile["oid"],
            {
                "einnahmen": Decimal("0"),
                "ausgaben": Decimal("0"),
                "anzahl": 0,
                "monat_einnahmen": {m: Decimal("0") for m in range(1, 13)},
                "monat_ausgaben": {m: Decimal("0") for m in range(1, 13)},
            },
        )
        try:
            betrag = Decimal(zeile["betrag"])
        except (ValueError, TypeError):
            continue
        eintrag["anzahl"] += 1
        try:
            monat = int(zeile["monat"])
        except (ValueError, TypeError):
            monat = 0

        if zeile["typ"] == "einnahme":
            eintrag["einnahmen"] += betrag
            if 1 <= monat <= 12:
                eintrag["monat_einnahmen"][monat] += betrag
        else:
            eintrag["ausgaben"] += betrag
            if 1 <= monat <= 12:
                eintrag["monat_ausgaben"][monat] += betrag
    return ergebnis
