"""Aktions-Log für die Rückgängig-Funktion.

Vor jeder rückgängig-machbaren Operation (Buchung anlegen/ändern/löschen,
Mietzahlung erfassen/zurücknehmen, Investition anlegen/löschen) speichert
die App den vorherigen Datensatz als JSON im Log. Ein Eintrag im Log
lässt sich später per ``aktion_zuruecknehmen`` rückgängig machen.

Bewusst einfach gehalten: keine kaskadierende Reihenfolge, kein
Konfliktlöser. Das Log ist für ein-Benutzer-Schutz vor versehentlichen
Klicks und nicht für komplexe Mehrbenutzer-Szenarien gedacht.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime


ART_ANLEGEN = "anlegen"
ART_AENDERN = "aendern"
ART_LOESCHEN = "loeschen"


def aktion_protokollieren(
    verbindung: sqlite3.Connection,
    art: str,
    tabelle: str,
    datensatz_id: int | None,
    zustand_alt: dict | None = None,
    zustand_neu: dict | None = None,
) -> None:
    """Speichert eine neue Aktion im Log (ohne Commit — Aufrufer committed)."""
    verbindung.execute(
        "INSERT INTO aktionen (zeit, art, tabelle, datensatz_id, "
        "zustand_alt, zustand_neu, zurueckgesetzt) "
        "VALUES (?, ?, ?, ?, ?, ?, 0)",
        (
            datetime.now().isoformat(timespec="seconds"),
            art, tabelle, datensatz_id,
            json.dumps(zustand_alt, ensure_ascii=False) if zustand_alt else None,
            json.dumps(zustand_neu, ensure_ascii=False) if zustand_neu else None,
        ),
    )


def aktionen_laden(
    verbindung: sqlite3.Connection, anzahl: int = 50
) -> list[sqlite3.Row]:
    """Lädt die letzten N Aktionen, neueste zuerst."""
    return verbindung.execute(
        "SELECT id, zeit, art, tabelle, datensatz_id, zustand_alt, "
        "zustand_neu, zurueckgesetzt FROM aktionen "
        "ORDER BY id DESC LIMIT ?",
        (anzahl,),
    ).fetchall()


def aktion_zuruecknehmen(
    verbindung: sqlite3.Connection, aktion_id: int
) -> str:
    """Macht eine geloggte Aktion rückgängig.

    Liefert eine kurze Beschreibung, was gemacht wurde, oder wirft
    ``ValueError`` bei Inkonsistenzen.
    """
    zeile = verbindung.execute(
        "SELECT * FROM aktionen WHERE id = ?", (aktion_id,)
    ).fetchone()
    if zeile is None:
        raise ValueError("Aktion nicht gefunden.")
    if zeile["zurueckgesetzt"]:
        raise ValueError("Diese Aktion wurde bereits rückgängig gemacht.")

    tabelle = zeile["tabelle"]
    datensatz_id = zeile["datensatz_id"]
    art = zeile["art"]
    alt = json.loads(zeile["zustand_alt"]) if zeile["zustand_alt"] else None

    if art == ART_ANLEGEN:
        verbindung.execute(
            f"DELETE FROM {tabelle} WHERE id = ?", (datensatz_id,)
        )
        meldung = f"Anlegen in „{tabelle}“ wurde zurückgenommen."
    elif art == ART_LOESCHEN and alt:
        spalten = ", ".join(alt.keys())
        platzhalter = ", ".join("?" * len(alt))
        verbindung.execute(
            f"INSERT INTO {tabelle} ({spalten}) VALUES ({platzhalter})",
            tuple(alt.values()),
        )
        meldung = f"Eintrag in „{tabelle}“ wurde wiederhergestellt."
    elif art == ART_AENDERN and alt:
        ohne_id = {k: v for k, v in alt.items() if k != "id"}
        set_stmt = ", ".join(f"{k} = ?" for k in ohne_id.keys())
        werte = list(ohne_id.values()) + [alt.get("id", datensatz_id)]
        verbindung.execute(
            f"UPDATE {tabelle} SET {set_stmt} WHERE id = ?", werte
        )
        meldung = f"Änderung in „{tabelle}“ wurde zurückgenommen."
    else:
        raise ValueError("Aktion kann nicht zurückgenommen werden.")

    verbindung.execute(
        "UPDATE aktionen SET zurueckgesetzt = 1 WHERE id = ?",
        (aktion_id,),
    )
    verbindung.commit()
    return meldung


def aktion_beschreiben(zeile: sqlite3.Row) -> str:
    """Bildet eine kurze, lesbare Beschreibung einer geloggten Aktion."""
    art_text = {ART_ANLEGEN: "Angelegt", ART_AENDERN: "Geändert",
                ART_LOESCHEN: "Gelöscht"}.get(zeile["art"], zeile["art"])
    return f"{art_text} in „{zeile['tabelle']}“ (ID {zeile['datensatz_id']})"
