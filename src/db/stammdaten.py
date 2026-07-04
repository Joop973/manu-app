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
    sql = ("SELECT id, name, aktiv, umlageschluessel, erkennungstext "
           "FROM objekte")
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
        "aktiv_von, aktiv_bis, wohnflaeche, personenzahl FROM mieter "
        "WHERE objekt_id = ? ORDER BY name COLLATE NOCASE",
        (objekt_id,),
    ).fetchall()


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
    sql = ("SELECT id, name, typ, aktiv, umlagefaehig "
           "FROM kategorien WHERE typ = ?")
    if nur_aktive:
        sql += " AND aktiv = 1"
    sql += " ORDER BY name COLLATE NOCASE"
    return verbindung.execute(sql, (typ,)).fetchall()


def kategorie_anlegen(
    verbindung: sqlite3.Connection, name: str, typ: str
) -> None:
    """Legt eine neue Kategorie an."""
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
        "INSERT INTO kategorien (name, typ, aktiv) VALUES (?, ?, 1)",
        (name, typ),
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
