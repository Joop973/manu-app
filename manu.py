"""Einstiegspunkt der Manu-App.

Ablauf beim Start:
1. Arbeitsordner sicherstellen.
2. Datenbank initialisieren (beim ersten Start inkl. Stammdaten).
3. PIN festlegen (erster Start) bzw. Anmeldung (weitere Starts).
4. Hauptfenster anzeigen.
"""

from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication, QDialog, QMessageBox

from src.db.einstellungen import PIN_AKTIV, SCHLUESSEL_PIN_MODUS, einstellung_lesen
from src.db.init import datenbank_initialisieren
from src.ui.login_dialog import LoginDialog, PinEinrichtenDialog
from src.ui.main_window import MainWindow, manu_symbol
from src.utils import paths


def main() -> int:
    """Startet die Anwendung und liefert den Exit-Code."""
    app = QApplication(sys.argv)
    app.setApplicationName("Manu")
    app.setWindowIcon(manu_symbol())

    paths.verzeichnisse_sicherstellen()

    # Datenbank bereitstellen
    try:
        verbindung = datenbank_initialisieren(paths.datenbank_pfad())
    except Exception as fehler:  # noqa: BLE001 - Anzeige statt Absturz
        QMessageBox.critical(
            None,
            "Start nicht möglich",
            "Die Datenbank konnte nicht initialisiert werden:\n"
            f"{fehler}",
        )
        return 1

    # PIN-Schutz einrichten (erster Start) bzw. anmelden.
    pin_modus = einstellung_lesen(verbindung, SCHLUESSEL_PIN_MODUS)
    if pin_modus is None:
        if PinEinrichtenDialog(verbindung).exec() != QDialog.Accepted:
            verbindung.close()
            return 0
    elif pin_modus == PIN_AKTIV:
        if LoginDialog(verbindung).exec() != QDialog.Accepted:
            verbindung.close()
            return 0
    # pin_modus == PIN_AUS: keine Anmeldung erforderlich

    # Hauptfenster anzeigen
    fenster = MainWindow(verbindung)
    fenster.show()
    exit_code = app.exec()

    verbindung.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
