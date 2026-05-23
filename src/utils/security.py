"""PIN-Schutz der Anwendung.

Der PIN wird niemals im Klartext gespeichert. Stattdessen wird mit
hashlib ein SHA-256-Hash aus einem zufälligen Salt und dem PIN
gebildet. Hash und Salt liegen in der Tabelle ``app_settings``.
"""

from __future__ import annotations

import hashlib
import os
import sqlite3

# Schlüssel, unter denen Hash und Salt in app_settings abgelegt werden.
_SCHLUESSEL_HASH = "passwort_hash"
_SCHLUESSEL_SALT = "passwort_salt"

# Mindestlänge des PINs (reine Eingabevalidierung).
MIN_PIN_LAENGE = 4


def _hash_bilden(pin: str, salt: str) -> str:
    """Bildet den SHA-256-Hash aus Salt und PIN."""
    roh = (salt + pin).encode("utf-8")
    return hashlib.sha256(roh).hexdigest()


def pin_gesetzt(verbindung: sqlite3.Connection) -> bool:
    """Prüft, ob bereits ein PIN hinterlegt wurde."""
    zeile = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?",
        (_SCHLUESSEL_HASH,),
    ).fetchone()
    return zeile is not None


def pin_festlegen(verbindung: sqlite3.Connection, pin: str) -> None:
    """Legt einen neuen PIN fest bzw. überschreibt den bestehenden."""
    salt = os.urandom(16).hex()
    hash_wert = _hash_bilden(pin, salt)
    verbindung.execute(
        "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (_SCHLUESSEL_SALT, salt),
    )
    verbindung.execute(
        "INSERT INTO app_settings (schluessel, wert) VALUES (?, ?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (_SCHLUESSEL_HASH, hash_wert),
    )
    verbindung.commit()


def pin_entfernen(verbindung: sqlite3.Connection) -> None:
    """Löscht den gespeicherten PIN-Hash und das Salt."""
    verbindung.execute(
        "DELETE FROM app_settings WHERE schluessel IN (?, ?)",
        (_SCHLUESSEL_HASH, _SCHLUESSEL_SALT),
    )
    verbindung.commit()


def pin_pruefen(verbindung: sqlite3.Connection, pin: str) -> bool:
    """Prüft, ob der eingegebene PIN zum gespeicherten Hash passt."""
    zeile_hash = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?",
        (_SCHLUESSEL_HASH,),
    ).fetchone()
    zeile_salt = verbindung.execute(
        "SELECT wert FROM app_settings WHERE schluessel = ?",
        (_SCHLUESSEL_SALT,),
    ).fetchone()
    if zeile_hash is None or zeile_salt is None:
        return False
    return _hash_bilden(pin, zeile_salt[0]) == zeile_hash[0]
