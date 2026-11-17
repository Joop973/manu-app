"""Datenzugriff für Stammdaten: Häuser, Mieter, Kategorien.

Kapselt alle SQL-Abfragen rund um die Stammdaten. Sämtliche Abfragen
nutzen Parameterbindung. Validierungsfehler (leere Namen, Duplikate)
werden als ``ValidierungsFehler`` mit GUI-tauglicher Meldung geworfen.
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from src.utils.eingaben import ValidierungsFehler

# =========================================================================
# Häuser / Objekte
# =========================================================================


def objekte_laden(
    verbindung: sqlite3.Connection, nur_aktive: bool = False
) -> list[sqlite3.Row]:
    """Lädt alle Häuser, optional nur die aktiven."""
    sql = ("SELECT id, name, aktiv, umlageschluessel, erkennungstext, "
           "adresse, gesamtflaeche, afa_bemessung, afa_beginn, afa_satz, "
           "kostenstelle FROM objekte")
    if nur_aktive:
        sql += " WHERE aktiv = 1"
    sql += " ORDER BY name COLLATE NOCASE"
    return verbindung.execute(sql).fetchall()


def objekt_erkennungstext_setzen(
    verbindung: sqlite3.Connection, objekt_id: int, text: str
) -> None:
    """Setzt den Erkennungstext (Straßenname o. ä.) eines Hauses."""
    verbindung.execute(
        "UPDATE objekte SET erkennungstext = ? WHERE id = ?",
        ((text or "").strip() or None, objekt_id),
    )
    verbindung.commit()


def _objekt_name_belegt(
    verbindung: sqlite3.Connection, name: str, ausser_id: int | None = None
) -> bool:
    """Prüft, ob ein Hausname bereits vergeben ist (unabhängig von Groß-/Kleinschreibung)."""
    if ausser_id is None:
        zeile = verbindung.execute(
            "SELECT 1 FROM objekte WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
    else:
        zeile = verbindung.execute(
            "SELECT 1 FROM objekte WHERE name = ? COLLATE NOCASE AND id != ?",
            (name, ausser_id),
        ).fetchone()
    return zeile is not None


def objekt_anlegen(verbindung: sqlite3.Connection, name: str) -> None:
    """Legt ein neues Haus an."""
    name = name.strip()
    if not name:
        raise ValidierungsFehler("Der Hausname darf nicht leer sein.")
    if _objekt_name_belegt(verbindung, name):
        raise ValidierungsFehler(f"Ein Haus „{name}“ existiert bereits.")
    verbindung.execute("INSERT INTO objekte (name, aktiv) VALUES (?, 1)", (name,))
    verbindung.commit()


def objekt_umbenennen(
    verbindung: sqlite3.Connection, objekt_id: int, neuer_name: str
) -> None:
    """Benennt ein bestehendes Haus um."""
    neuer_name = neuer_name.strip()
    if not neuer_name:
        raise ValidierungsFehler("Der Hausname darf nicht leer sein.")
    if _objekt_name_belegt(verbindung, neuer_name, ausser_id=objekt_id):
        raise ValidierungsFehler(f"Ein Haus „{neuer_name}“ existiert bereits.")
    verbindung.execute(
        "UPDATE objekte SET name = ? WHERE id = ?", (neuer_name, objekt_id)
    )
    verbindung.commit()


def objekt_aktiv_setzen(
    verbindung: sqlite3.Connection, objekt_id: int, aktiv: bool
) -> None:
    """Aktiviert oder deaktiviert ein Haus (Häuser werden nie gelöscht)."""
    verbindung.execute(
        "UPDATE objekte SET aktiv = ? WHERE id = ?",
        (1 if aktiv else 0, objekt_id),
    )
    verbindung.commit()


def objekt_steuerdaten_setzen(
    verbindung: sqlite3.Connection,
    objekt_id: int,
    adresse: str | None,
    gesamtflaeche: Decimal | None,
    afa_bemessung: Decimal | None,
    afa_beginn: str | None,
    afa_satz: Decimal | None,
    kostenstelle: str | None,
) -> None:
    """Speichert Anlage-V-, AfA-, Nebenkosten- und DATEV-Daten eines Hauses.

    Leere Werte werden als NULL gespeichert (= nicht hinterlegt).
    """
    if afa_satz is not None and not Decimal("0") < afa_satz <= Decimal("100"):
        raise ValidierungsFehler("Der AfA-Satz muss zwischen 0 und 100 % liegen.")
    angaben_afa = [afa_bemessung, afa_beginn, afa_satz]
    if any(a not in (None, "") for a in angaben_afa) and not all(
        a not in (None, "") for a in angaben_afa
    ):
        raise ValidierungsFehler(
            "Für die Gebäude-AfA bitte alle drei Angaben machen "
            "(Bemessungsgrundlage, Beginn, Satz) – oder alle leer lassen."
        )
    kst = (kostenstelle or "").strip() or None
    if kst is not None and (len(kst) > 36 or not all(
            z.isascii() and (z.isalnum() or z == " ") for z in kst)):
        raise ValidierungsFehler(
            "Die Kostenstelle darf nur Buchstaben/Ziffern enthalten "
            "(max. 36 Zeichen)."
        )
    verbindung.execute(
        "UPDATE objekte SET adresse = ?, gesamtflaeche = ?, afa_bemessung = ?, "
        "afa_beginn = ?, afa_satz = ?, kostenstelle = ? WHERE id = ?",
        (
            (adresse or "").strip() or None,
            None if gesamtflaeche is None else str(gesamtflaeche),
            None if afa_bemessung is None else str(afa_bemessung),
            afa_beginn or None,
            None if afa_satz is None else str(afa_satz),
            kst,
            objekt_id,
        ),
    )
    verbindung.commit()


# Gültige Umlageschlüssel für die Nebenkostenabrechnung.
UMLAGESCHLUESSEL = {
    "flaeche": "nach Wohnfläche (m²)",
    "personen": "nach Personenzahl",
    "gleich": "zu gleichen Teilen",
}


def objekt_umlageschluessel_setzen(
    verbindung: sqlite3.Connection, objekt_id: int, schluessel: str
) -> None:
    """Legt den Umlageschlüssel eines Hauses fest."""
    if schluessel not in UMLAGESCHLUESSEL:
        raise ValidierungsFehler("Unbekannter Umlageschlüssel.")
    verbindung.execute(
        "UPDATE objekte SET umlageschluessel = ? WHERE id = ?",
        (schluessel, objekt_id),
    )
    verbindung.commit()


# =========================================================================
# Mieter
# =========================================================================


def mieter_laden(
    verbindung: sqlite3.Connection, objekt_id: int
) -> list[sqlite3.Row]:
    """Lädt alle Mieter eines Hauses."""
    return verbindung.execute(
        "SELECT id, objekt_id, name, kaltmiete, nebenkosten, ruecklage, "
        "aktiv_von, aktiv_bis, wohnflaeche, personenzahl, umlage_gewicht "
        "FROM mieter WHERE objekt_id = ? ORDER BY name COLLATE NOCASE",
        (objekt_id,),
    ).fetchall()


def mieter_umlage_gewicht_setzen(
    verbindung: sqlite3.Connection, mieter_id: int, gewicht: str | None
) -> None:
    """Setzt das manuelle Umlage-Gewicht eines Mieters (None = automatisch).

    Ein gesetztes Gewicht überschreibt in der Nebenkostenabrechnung den
    automatischen Schlüsselwert (Fläche/Personen/gleich).
    """
    wert: str | None = None
    if gewicht is not None and str(gewicht).strip() != "":
        from src.utils.eingaben import betrag_parsen
        wert = str(betrag_parsen(str(gewicht)))
    verbindung.execute(
        "UPDATE mieter SET umlage_gewicht = ? WHERE id = ?",
        (wert, mieter_id),
    )
    verbindung.commit()


def mieter_alle_laden(verbindung: sqlite3.Connection) -> list[sqlite3.Row]:
    """Lädt alle Mieter über alle Häuser hinweg, inkl. Hausname."""
    return verbindung.execute(
        "SELECT m.id, m.objekt_id, m.name, m.kaltmiete, m.nebenkosten, "
        "m.ruecklage, m.aktiv_von, m.aktiv_bis, m.wohnflaeche, "
        "m.personenzahl, o.name AS objekt_name "
        "FROM mieter m JOIN objekte o ON o.id = m.objekt_id "
        "ORDER BY o.name COLLATE NOCASE, m.name COLLATE NOCASE"
    ).fetchall()


def _mieter_name_belegt(
    verbindung: sqlite3.Connection,
    objekt_id: int,
    name: str,
    ausser_id: int | None = None,
) -> bool:
    """Prüft, ob im selben Haus bereits ein Mieter mit diesem Namen geführt wird."""
    if ausser_id is None:
        zeile = verbindung.execute(
            "SELECT 1 FROM mieter WHERE objekt_id = ? AND name = ? COLLATE NOCASE",
            (objekt_id, name),
        ).fetchone()
    else:
        zeile = verbindung.execute(
            "SELECT 1 FROM mieter WHERE objekt_id = ? AND name = ? COLLATE NOCASE "
            "AND id != ?",
            (objekt_id, name, ausser_id),
        ).fetchone()
    return zeile is not None


def mieter_anlegen(
    verbindung: sqlite3.Connection,
    objekt_id: int,
    name: str,
    kaltmiete: Decimal,
    nebenkosten: Decimal,
    ruecklage: Decimal,
    aktiv_von: str | None,
    aktiv_bis: str | None,
    wohnflaeche: Decimal,
    personenzahl: int,
) -> None:
    """Legt einen neuen Mieter für ein Haus an."""
    name = name.strip()
    if not name:
        raise ValidierungsFehler("Der Mietername darf nicht leer sein.")
    if _mieter_name_belegt(verbindung, objekt_id, name):
        raise ValidierungsFehler(
            f"In diesem Haus gibt es bereits einen Mieter „{name}“."
        )
    verbindung.execute(
        "INSERT INTO mieter "
        "(objekt_id, name, kaltmiete, nebenkosten, ruecklage, aktiv_von, "
        "aktiv_bis, wohnflaeche, personenzahl) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            objekt_id,
            name,
            str(kaltmiete),
            str(nebenkosten),
            str(ruecklage),
            aktiv_von,
            aktiv_bis,
            str(wohnflaeche),
            personenzahl,
        ),
    )
    verbindung.commit()


def mieter_aktualisieren(
    verbindung: sqlite3.Connection,
    mieter_id: int,
    name: str,
    kaltmiete: Decimal,
    nebenkosten: Decimal,
    ruecklage: Decimal,
    aktiv_von: str | None,
    aktiv_bis: str | None,
    wohnflaeche: Decimal,
    personenzahl: int,
) -> None:
    """Aktualisiert die Daten eines bestehenden Mieters."""
    name = name.strip()
    if not name:
        raise ValidierungsFehler("Der Mietername darf nicht leer sein.")
    zeile = verbindung.execute(
        "SELECT objekt_id FROM mieter WHERE id = ?", (mieter_id,)
    ).fetchone()
    if zeile is None:
        raise ValidierungsFehler("Der Mieter wurde nicht gefunden.")
    if _mieter_name_belegt(verbindung, zeile["objekt_id"], name, ausser_id=mieter_id):
        raise ValidierungsFehler(
            f"In diesem Haus gibt es bereits einen Mieter „{name}“."
        )
    verbindung.execute(
        "UPDATE mieter SET name = ?, kaltmiete = ?, nebenkosten = ?, "
        "ruecklage = ?, aktiv_von = ?, aktiv_bis = ?, wohnflaeche = ?, "
        "personenzahl = ? WHERE id = ?",
        (
            name,
            str(kaltmiete),
            str(nebenkosten),
            str(ruecklage),
            aktiv_von,
            aktiv_bis,
            str(wohnflaeche),
            personenzahl,
            mieter_id,
        ),
    )
    verbindung.commit()


# =========================================================================
# Kategorien
# =========================================================================


def kategorien_laden(
    verbindung: sqlite3.Connection, typ: str, nur_aktive: bool = False
) -> list[sqlite3.Row]:
    """Lädt alle Kategorien eines Typs ('ausgabe' oder 'einnahme')."""
    sql = ("SELECT id, name, typ, aktiv, umlagefaehig, steuer_art, "
           "steuer_prozent, rolle, datev_konto "
           "FROM kategorien WHERE typ = ?")
    if nur_aktive:
        sql += " AND aktiv = 1"
    sql += " ORDER BY name COLLATE NOCASE"
    return verbindung.execute(sql, (typ,)).fetchall()


def kategorie_anlegen(
    verbindung: sqlite3.Connection, name: str, typ: str,
    steuer_art: str | None = None,
) -> None:
    """Legt eine neue Kategorie an (optional mit steuerlicher Art)."""
    name = name.strip()
    if not name:
        raise ValidierungsFehler("Der Kategoriename darf nicht leer sein.")
    if typ not in ("ausgabe", "einnahme"):
        raise ValidierungsFehler("Ungültiger Kategorietyp.")
    zeile = verbindung.execute(
        "SELECT 1 FROM kategorien WHERE name = ? COLLATE NOCASE AND typ = ?",
        (name, typ),
    ).fetchone()
    if zeile is not None:
        raise ValidierungsFehler(f"Die Kategorie „{name}“ existiert bereits.")
    verbindung.execute(
        "INSERT INTO kategorien (name, typ, aktiv, steuer_art) "
        "VALUES (?, ?, 1, ?)",
        (name, typ, steuer_art),
    )
    verbindung.commit()


def kategorie_steuer_setzen(
    verbindung: sqlite3.Connection,
    kategorie_id: int,
    steuer_art: str | None,
    steuer_prozent: Decimal | None,
    datev_konto: str | None,
) -> None:
    """Legt steuerliche Art, Voreinstellung des Anteils und DATEV-Konto fest."""
    from src.logic.steuer import STEUER_ARTEN

    if steuer_art is not None and steuer_art not in STEUER_ARTEN:
        raise ValidierungsFehler("Unbekannte steuerliche Art.")
    prozent = Decimal("100") if steuer_prozent is None else steuer_prozent
    if not Decimal("0") <= prozent <= Decimal("100"):
        raise ValidierungsFehler("Der Anteil muss zwischen 0 und 100 % liegen.")
    konto = (datev_konto or "").strip() or None
    if konto is not None and (not konto.isdigit() or len(konto) > 9):
        raise ValidierungsFehler("Das DATEV-Konto besteht nur aus Ziffern.")
    verbindung.execute(
        "UPDATE kategorien SET steuer_art = ?, steuer_prozent = ?, "
        "datev_konto = ? WHERE id = ?",
        (steuer_art, str(prozent), konto, kategorie_id),
    )
    verbindung.commit()


def kategorie_nach_rolle(
    verbindung: sqlite3.Connection, rolle: str
) -> int | None:
    """Liefert die ID der Einnahme-Kategorie mit fester Rolle.

    Rollen: ``kaltmiete``, ``nebenkosten``, ``ruecklage``. Fällt auf die
    historischen Namen zurück, falls keine Rolle hinterlegt ist.
    """
    zeile = verbindung.execute(
        "SELECT id FROM kategorien WHERE rolle = ? AND typ = 'einnahme' "
        "ORDER BY aktiv DESC, id LIMIT 1",
        (rolle,),
    ).fetchone()
    if zeile is not None:
        return zeile["id"]
    alt = {"kaltmiete": "Kaltmiete", "nebenkosten": "Nebenkosten",
           "ruecklage": "Rücklage"}.get(rolle)
    if alt is None:
        return None
    zeile = verbindung.execute(
        "SELECT id FROM kategorien WHERE name = ? COLLATE NOCASE "
        "AND typ = 'einnahme'",
        (alt,),
    ).fetchone()
    return zeile["id"] if zeile else None


def haus_anteile_laden(
    verbindung: sqlite3.Connection, kategorie_id: int
) -> dict[int, Decimal]:
    """Abweichende Anteile einer Kategorie je Haus: {objekt_id: prozent}."""
    return {
        z["objekt_id"]: Decimal(z["prozent"])
        for z in verbindung.execute(
            "SELECT objekt_id, prozent FROM kategorie_haus_anteil "
            "WHERE kategorie_id = ?",
            (kategorie_id,),
        ).fetchall()
    }


def haus_anteil_setzen(
    verbindung: sqlite3.Connection, kategorie_id: int, objekt_id: int,
    prozent: Decimal | None,
) -> None:
    """Setzt (oder löscht bei ``None``) den Anteil für ein Haus."""
    if prozent is None:
        verbindung.execute(
            "DELETE FROM kategorie_haus_anteil WHERE kategorie_id = ? "
            "AND objekt_id = ?",
            (kategorie_id, objekt_id),
        )
    else:
        if not Decimal("0") <= prozent <= Decimal("100"):
            raise ValidierungsFehler(
                "Der Anteil muss zwischen 0 und 100 % liegen."
            )
        verbindung.execute(
            "INSERT INTO kategorie_haus_anteil (objekt_id, kategorie_id, "
            "prozent) VALUES (?, ?, ?) ON CONFLICT(objekt_id, kategorie_id) "
            "DO UPDATE SET prozent = excluded.prozent",
            (objekt_id, kategorie_id, str(prozent)),
        )
    verbindung.commit()


def kategorie_umbenennen(
    verbindung: sqlite3.Connection, kategorie_id: int, neuer_name: str
) -> None:
    """Benennt eine Kategorie um (Buchungen behalten ihre Zuordnung)."""
    neuer_name = neuer_name.strip()
    if not neuer_name:
        raise ValidierungsFehler("Der Kategoriename darf nicht leer sein.")
    typ_zeile = verbindung.execute(
        "SELECT typ FROM kategorien WHERE id = ?", (kategorie_id,)
    ).fetchone()
    if typ_zeile is None:
        raise ValidierungsFehler("Die Kategorie wurde nicht gefunden.")
    kollision = verbindung.execute(
        "SELECT 1 FROM kategorien WHERE name = ? COLLATE NOCASE AND typ = ? "
        "AND id != ?",
        (neuer_name, typ_zeile["typ"], kategorie_id),
    ).fetchone()
    if kollision is not None:
        raise ValidierungsFehler(
            f"Die Kategorie „{neuer_name}“ existiert bereits."
        )
    verbindung.execute(
        "UPDATE kategorien SET name = ? WHERE id = ?",
        (neuer_name, kategorie_id),
    )
    verbindung.commit()


def kategorie_holen_oder_anlegen(
    verbindung: sqlite3.Connection, name: str, typ: str
) -> int:
    """Liefert die ID einer Kategorie und legt sie bei Bedarf neu an.

    Grundlage für den „Rahmen"-Modus: passt keine bestehende Kategorie,
    entsteht automatisch eine neue mit dem übergebenen Namen. Gibt die
    Kategorie-ID zurück.
    """
    name = (name or "").strip()
    if not name:
        name = "Sonstiges"
    if typ not in ("ausgabe", "einnahme"):
        typ = "ausgabe"
    zeile = verbindung.execute(
        "SELECT id FROM kategorien WHERE name = ? COLLATE NOCASE AND typ = ?",
        (name, typ),
    ).fetchone()
    if zeile is not None:
        return zeile["id"]
    cursor = verbindung.execute(
        "INSERT INTO kategorien (name, typ, aktiv) VALUES (?, ?, 1)",
        (name, typ),
    )
    verbindung.commit()
    return cursor.lastrowid


def kategorien_zusammenlegen(
    verbindung: sqlite3.Connection, quelle_id: int, ziel_id: int
) -> int:
    """Lässt eine Kategorie in einer anderen aufgehen.

    Alle Buchungen, gelernten Muster und Regeln der Quell-Kategorie
    wandern zur Ziel-Kategorie; die Quelle wird gelöscht. Beide müssen
    denselben Typ (Einnahme/Ausgabe) haben. Liefert die Zahl der
    umgehängten Buchungen.
    """
    if quelle_id == ziel_id:
        raise ValidierungsFehler("Quelle und Ziel sind dieselbe Kategorie.")
    quelle = verbindung.execute(
        "SELECT typ FROM kategorien WHERE id = ?", (quelle_id,)
    ).fetchone()
    ziel = verbindung.execute(
        "SELECT typ FROM kategorien WHERE id = ?", (ziel_id,)
    ).fetchone()
    if quelle is None or ziel is None:
        raise ValidierungsFehler("Eine der Kategorien wurde nicht gefunden.")
    if quelle["typ"] != ziel["typ"]:
        raise ValidierungsFehler(
            "Einnahme- und Ausgabe-Kategorien können nicht "
            "zusammengelegt werden."
        )
    cursor = verbindung.execute(
        "UPDATE buchungen SET kategorie_id = ? WHERE kategorie_id = ?",
        (ziel_id, quelle_id),
    )
    verbindung.execute(
        "UPDATE buchungsmuster SET kategorie_id = ? WHERE kategorie_id = ?",
        (ziel_id, quelle_id),
    )
    verbindung.execute(
        "UPDATE regeln SET kategorie_id = ? WHERE kategorie_id = ?",
        (ziel_id, quelle_id),
    )
    # Haus-Anteile der Quelle übernehmen, sofern das Ziel keine hat.
    verbindung.execute(
        "INSERT OR IGNORE INTO kategorie_haus_anteil "
        "(objekt_id, kategorie_id, prozent) "
        "SELECT objekt_id, ?, prozent FROM kategorie_haus_anteil "
        "WHERE kategorie_id = ?",
        (ziel_id, quelle_id),
    )
    verbindung.execute(
        "DELETE FROM kategorie_haus_anteil WHERE kategorie_id = ?",
        (quelle_id,),
    )
    verbindung.execute("DELETE FROM kategorien WHERE id = ?", (quelle_id,))
    verbindung.commit()
    return cursor.rowcount


def kategorie_aktiv_setzen(
    verbindung: sqlite3.Connection, kategorie_id: int, aktiv: bool
) -> None:
    """Aktiviert oder deaktiviert eine Kategorie."""
    verbindung.execute(
        "UPDATE kategorien SET aktiv = ? WHERE id = ?",
        (1 if aktiv else 0, kategorie_id),
    )
    verbindung.commit()


def kategorie_umlagefaehig_setzen(
    verbindung: sqlite3.Connection, kategorie_id: int, umlagefaehig: bool
) -> None:
    """Legt fest, ob eine Kategorie in die Nebenkostenabrechnung einfließt."""
    verbindung.execute(
        "UPDATE kategorien SET umlagefaehig = ? WHERE id = ?",
        (1 if umlagefaehig else 0, kategorie_id),
    )
    verbindung.commit()
