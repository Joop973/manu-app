"""Gemeinsame Test-Hilfen: frische Datenbank in einem Temp-Ordner."""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db.init import datenbank_initialisieren  # noqa: E402
from src.utils import paths  # noqa: E402


@pytest.fixture
def app_ordner(tmp_path, monkeypatch):
    """Leitet alle App-Pfade (DB, Belege, Exporte) in einen Temp-Ordner."""
    monkeypatch.setattr(paths, "app_verzeichnis", lambda: tmp_path)
    paths.verzeichnisse_sicherstellen()
    return tmp_path


@pytest.fixture
def db(app_ordner):
    verbindung = datenbank_initialisieren(app_ordner / "controlling.db")
    yield verbindung
    verbindung.close()


def kategorie_id(verbindung, name: str, typ: str | None = None) -> int:
    sql = "SELECT id FROM kategorien WHERE name = ?"
    params: list = [name]
    if typ:
        sql += " AND typ = ?"
        params.append(typ)
    zeile = verbindung.execute(sql, params).fetchone()
    assert zeile is not None, f"Kategorie {name} fehlt"
    return zeile["id"]


def haus_id(verbindung, name: str) -> int:
    return verbindung.execute(
        "SELECT id FROM objekte WHERE name = ?", (name,)
    ).fetchone()["id"]


def mieter_anlegen(verbindung, haus: int, name: str, kalt="500", nk="150",
                   flaeche="50", von=None, bis=None) -> int:
    from src.db import stammdaten

    stammdaten.mieter_anlegen(
        verbindung, haus, name, Decimal(kalt), Decimal(nk), Decimal("0"),
        von, bis, Decimal(flaeche), 1,
    )
    return verbindung.execute(
        "SELECT id FROM mieter WHERE name = ?", (name,)
    ).fetchone()["id"]
