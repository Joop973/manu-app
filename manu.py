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

from src.db.init import datenbank_initialisieren
from src.ui.login_dialog import LoginDialog, PinFestlegenDialog
from src.ui.main_window import MainWindow
from src.utils import paths, security


def main() -> int:
    """Startet die Anwendung und liefert den Exit-Code."""
    app = QApplication(sys.argv)
    app.setApplicationName("Manu")

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

    # PIN festlegen oder anmelden
    if security.pin_gesetzt(verbindung):
        dialog = LoginDialog(verbindung)
    else:
        dialog = PinFestlegenDialog(verbindung)

    if dialog.exec() != QDialog.Accepted:
        verbindung.close()
        return 0

    # Hauptfenster anzeigen
    fenster = MainWindow(verbindung)
    fenster.show()
    exit_code = app.exec()

    verbindung.close()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
