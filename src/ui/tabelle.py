"""Gemeinsame Helfer für Tabellen-Widgets.

Vereinheitlicht das Aussehen aller Tabellen (nur Lesen, Zeilenauswahl,
sortierbare Spalten) und stellt eine Zelle bereit, die nach einem
separaten Sortierschlüssel sortiert.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import (
    QAbstractItemView,
    QHeaderView,
    QTableWidget,
    QTableWidgetItem,
)


def tabelle_vorbereiten(tabelle: QTableWidget, sortierbar: bool = True) -> None:
    """Setzt die gemeinsamen Tabelleneinstellungen."""
    tabelle.setEditTriggers(QAbstractItemView.NoEditTriggers)
    tabelle.setSelectionBehavior(QAbstractItemView.SelectRows)
    tabelle.setSelectionMode(QAbstractItemView.SingleSelection)
    tabelle.verticalHeader().setVisible(False)
    tabelle.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
    tabelle.setSortingEnabled(sortierbar)


class SortierItem(QTableWidgetItem):
    """Tabellenzelle, die nach einem getrennten Sortierschlüssel sortiert.

    So lassen sich z. B. Geldbeträge numerisch sortieren, obwohl sie als
    formatierter Text (``1.250,50 €``) angezeigt werden.
    """

    def __init__(self, anzeige: str, schluessel: Any) -> None:
        super().__init__(anzeige)
        self._schluessel = schluessel

    def __lt__(self, other: QTableWidgetItem) -> bool:
        if isinstance(other, SortierItem):
            try:
                return self._schluessel < other._schluessel
            except TypeError:
                pass
        return super().__lt__(other)
