"""Absetzung für Abnutzung (AfA) und Verteilung von Erhaltungsaufwand.

Alle Rechnungen arbeiten mit ``Decimal`` und runden jeden Jahresbetrag
kaufmännisch auf den Cent. Über die gesamte Laufzeit ergibt die Summe
der Jahresbeträge exakt die Bemessungsgrundlage: das letzte Jahr nimmt
den verbleibenden Restbetrag auf (auch den Rest, der durch die
zeitanteilige AfA im Anschaffungsjahr entsteht).

Rechtsgrundlagen (vereinfacht):
* § 7 Abs. 1 Satz 4 EStG — im Jahr der Anschaffung/Herstellung nur
  zeitanteilig, volle Monate ab dem Anschaffungsmonat.
* § 7 Abs. 4 EStG — lineare Gebäude-AfA (z. B. 2 %, 2,5 % oder 3 %,
  abhängig vom Fertigstellungsjahr).
* § 82b EStDV — größerer Erhaltungsaufwand an Wohngebäuden darf
  gleichmäßig auf 2 bis 5 Jahre verteilt werden.
"""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
_NULL = Decimal("0")


def cent(wert: Decimal) -> Decimal:
    """Rundet kaufmännisch auf ganze Cent."""
    return wert.quantize(CENT, rounding=ROUND_HALF_UP)


def lineare_afa_plan(
    bemessung: Decimal, beginn: date, satz_prozent: Decimal
) -> dict[int, Decimal]:
    """Liefert den vollständigen AfA-Plan ``{jahr: betrag}``.

    ``satz_prozent`` ist der jährliche AfA-Satz (z. B. ``2`` für 2 %).
    Im Anschaffungsjahr wird nur der Anteil der vollen Monate ab dem
    Anschaffungsmonat angesetzt; das letzte Jahr nimmt den Restwert auf.
    """
    if bemessung <= 0 or satz_prozent <= 0:
        return {}
    jahres_afa = bemessung * satz_prozent / Decimal(100)
    plan: dict[int, Decimal] = {}
    rest = bemessung
    jahr = beginn.year
    erstes = True
    # Obergrenze schützt vor Endlosschleifen bei Mini-Sätzen.
    while rest > 0 and jahr <= beginn.year + 1000:
        if erstes:
            monate = 13 - beginn.month
            regulär = cent(jahres_afa * Decimal(monate) / Decimal(12))
            erstes = False
        else:
            regulär = cent(jahres_afa)
        betrag = min(regulär, rest)
        if betrag <= 0:
            # Rundung auf 0 (Kleinstbeträge): Rest sofort ansetzen.
            betrag = rest
        plan[jahr] = betrag
        rest -= betrag
        jahr += 1
    return plan


def lineare_afa_im_jahr(
    bemessung: Decimal, beginn: date, satz_prozent: Decimal, jahr: int
) -> Decimal:
    """AfA-Betrag eines einzelnen Jahres (0, wenn außerhalb der Laufzeit)."""
    return lineare_afa_plan(bemessung, beginn, satz_prozent).get(jahr, _NULL)


def restwert_zum_jahresende(
    bemessung: Decimal, beginn: date, satz_prozent: Decimal, jahr: int
) -> Decimal:
    """Restbuchwert nach Abzug aller AfA-Beträge bis einschließlich ``jahr``."""
    plan = lineare_afa_plan(bemessung, beginn, satz_prozent)
    abgeschrieben = sum(
        (betrag for j, betrag in plan.items() if j <= jahr), _NULL
    )
    return bemessung - abgeschrieben


def verteilung_82b(
    betrag: Decimal, start_jahr: int, jahre: int
) -> dict[int, Decimal]:
    """Verteilt Erhaltungsaufwand gleichmäßig auf ``jahre`` Jahre.

    ``jahre = 1`` bedeutet Sofortabzug. Der Rundungsrest landet im
    letzten Jahr, sodass die Summe exakt dem Gesamtbetrag entspricht.
    """
    jahre = max(1, min(int(jahre or 1), 5))
    teil = cent(betrag / Decimal(jahre))
    plan = {start_jahr + i: teil for i in range(jahre - 1)}
    plan[start_jahr + jahre - 1] = betrag - teil * (jahre - 1)
    return plan
