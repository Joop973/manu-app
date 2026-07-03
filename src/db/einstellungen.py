"""Zugriff auf die Einstellungstabelle ``app_settings``.

Schlüssel-Wert-Speicher für allgemeine Einstellungen wie den
Backup-Ordner. PIN-Hash und -Salt liegen in derselben Tabelle, werden
aber über ``src/utils/security.py`` verwaltet.
"""

from __future__ import annotations

import sqlite3

# Bekannte Einstellungsschlüssel.
SCHLUESSEL_BACKUP_PFAD = "backup_pfad"
# PIN-Modus: "aktiv" = Anmeldung erforderlich, "aus" = ohne PIN starten.
SCHLUESSEL_PIN_MODUS = "pin_modus"
PIN_AKTIV = "aktiv"
PIN_AUS = "aus"
# Standard-Haus für den Import: Buchungen ohne erkennbares Haus werden
# diesem Haus zugeordnet (ID als Text). Leer = keine Vorbelegung.
SCHLUESSEL_STANDARD_HAUS = "standard_haus_id"
# Vollautomatik beim Import: "1" = sicher zugeordnete Buchungen sofort
# übernehmen (Vorschau nur für unklare Fälle), "0" = immer Vorschau.
SCHLUESSEL_AUTO_IMPORT = "auto_import"


def einstellung_lesen(
    verbindung: sqlite3.Connection, schluessel: str, standard: str | None = None
) -> str | None:
    """Liest einen Einstellungswert oder liefert den Standardwert."""
    zeile = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?", (schluessel,)
    ).fetchone()
    return zeile["wert"] if zeile is not None else standard


def einstellung_schreiben(
    verbindung: sqlite3.Connection, schluessel: str, wert: str
) -> None:
    """Speichert einen Einstellungswert (legt ihn bei Bedarf an)."""
    verbindung.execute(
        "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (schluessel, wert),
    )
    verbindung.commit()
