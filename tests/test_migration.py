"""Umstellung einer Datenbank im alten Stand (Schema 9) auf Schema 10."""

from __future__ import annotations

import sqlite3
from datetime import date

from src.db.init import SCHLUESSEL_UPDATE_HINWEIS, datenbank_initialisieren

ALT_SCHEMA = [
    "CREATE TABLE objekte (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT "
    "NOT NULL UNIQUE, aktiv INTEGER NOT NULL DEFAULT 1, umlageschluessel TEXT "
    "NOT NULL DEFAULT 'flaeche', erkennungstext TEXT)",
    "CREATE TABLE mieter (id INTEGER PRIMARY KEY AUTOINCREMENT, objekt_id "
    "INTEGER NOT NULL, name TEXT NOT NULL, kaltmiete TEXT NOT NULL DEFAULT "
    "'0', nebenkosten TEXT NOT NULL DEFAULT '0', ruecklage TEXT NOT NULL "
    "DEFAULT '0', aktiv_von TEXT, aktiv_bis TEXT, wohnflaeche TEXT NOT NULL "
    "DEFAULT '0', personenzahl INTEGER NOT NULL DEFAULT 1, umlage_gewicht TEXT)",
    "CREATE TABLE kategorien (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT "
    "NOT NULL, typ TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1, "
    "umlagefaehig INTEGER NOT NULL DEFAULT 0, UNIQUE (name, typ))",
    "CREATE TABLE buchungen (id INTEGER PRIMARY KEY AUTOINCREMENT, datum TEXT "
    "NOT NULL, betrag TEXT NOT NULL, objekt_id INTEGER, kategorie_id INTEGER, "
    "mieter_id INTEGER, beschreibung TEXT, beleg_pfad TEXT, quelle TEXT)",
    "CREATE TABLE mietzahlungen (id INTEGER PRIMARY KEY AUTOINCREMENT, "
    "mieter_id INTEGER NOT NULL, monat INTEGER NOT NULL, jahr INTEGER NOT "
    "NULL, betrag TEXT NOT NULL, datum_eingang TEXT, UNIQUE (mieter_id, "
    "monat, jahr))",
    "CREATE TABLE app_settings (schluessel TEXT PRIMARY KEY, wert TEXT)",
]


def test_migration_v9_nach_v10(tmp_path, monkeypatch):
    from src.utils import paths
    monkeypatch.setattr(paths, "app_verzeichnis", lambda: tmp_path)
    pfad = tmp_path / "controlling.db"
    alt = sqlite3.connect(pfad)
    for sql in ALT_SCHEMA:
        alt.execute(sql)
    alt.execute("INSERT INTO objekte (name) VALUES ('Südstraße')")
    for name, typ in [("Finanzamt", "ausgabe"), ("Gas", "ausgabe"),
                      ("Kaltmiete", "einnahme"), ("Nebenkosten", "einnahme"),
                      ("Rücklage", "einnahme"), ("Sonstiges", "ausgabe"),
                      ("Gemeinde/Grundbesitz", "ausgabe")]:
        alt.execute("INSERT INTO kategorien (name, typ) VALUES (?, ?)",
                    (name, typ))
    zukunft = f"{date.today().year + 1}-12-30"
    alt.execute("INSERT INTO buchungen (datum, betrag, objekt_id, kategorie_id,"
                " beschreibung, quelle) VALUES (?, '23.00', 1, 2, 'Gas', "
                "'import')", (zukunft,))
    alt.execute("INSERT INTO app_settings VALUES ('schema_version', '9')")
    alt.commit()
    alt.close()

    v = datenbank_initialisieren(pfad)
    namen = {z["name"]: z for z in v.execute("SELECT * FROM kategorien")}
    assert namen["Einkommensteuer/Finanzamt (privat)"]["steuer_art"] == "privat"
    assert namen["Heizung/Gas"]["steuer_art"] == "wk_laufend"
    assert namen["Grundsteuer/Gemeindeabgaben"]["steuer_art"] == "wk_laufend"
    assert namen["Nebenkosten-Vorauszahlung"]["rolle"] == "nebenkosten"
    assert namen["Rücklage (Umbuchung eigenes Geld)"]["steuer_art"] == "neutral"
    assert namen["Sonstiges"]["steuer_art"] is None
    assert "Reparaturen/Instandhaltung" in namen
    datum = v.execute("SELECT datum FROM buchungen").fetchone()["datum"]
    assert datum == f"{date.today().year}-12-30"
    assert v.execute("SELECT wert FROM app_settings WHERE schluessel = ?",
                     (SCHLUESSEL_UPDATE_HINWEIS,)).fetchone() is not None
    assert list((tmp_path / "sicherungen").glob("controlling_vor_update_v10_*"))
    assert v.execute("SELECT wert FROM app_settings WHERE schluessel = "
                     "'schema_version'").fetchone()["wert"] == "10"
    v.close()
    # Zweiter Start ändert nichts mehr.
    v2 = datenbank_initialisieren(pfad)
    assert v2.execute("SELECT COUNT(*) FROM kategorien").fetchone()[0] == len(
        namen)
    v2.close()
