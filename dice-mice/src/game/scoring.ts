// =====================================================================
// Wertung einer Runde.
//
// AUFLÖSUNG DER OFFENEN ENTSCHEIDUNGEN (siehe Plan, Abschnitt 5):
//
// Orange + Sabotage – Timing:
//   Die gesamte Wertung wird AM RUNDENENDE aus einem Schnappschuss der
//   geworfenen Würfel berechnet, in fester Reihenfolge. Dadurch gibt es
//   keine Reihenfolge-Mehrdeutigkeit beim Werten.
//   Reihenfolge:
//     1. Pro Spieler Standard-, Braun- und Orange-Beitrag -> `base`.
//        (Orange liest die in DERSELBEN Runde von DIESEM Spieler
//         geworfenen verschiedenen Farben.)
//     2. Käse-Krone bestimmen (höchste Gelb-Summe; Tie-Break: höhere
//        base-Punkte; dann stabile Spielerreihenfolge).
//     3. Sabotage anwenden: kombinierte Sabotage-Summe je Werfer wird
//        dem Kronenhalter abgezogen – bzw. dem nächstbesten Spieler
//        (nach base-Punkten), falls der Werfer selbst die Krone hält.
//   Sabotage wirkt also NACH der Basiswertung und liest ausschließlich
//   die base-Punkte (nicht die bereits sabotierten Werte) – das hält die
//   Auswertung frei von Zirkelbezügen.
//
// Braun – Balance: Face-Werte sind konfigurierbar (dice.ts, BROWN_PRESETS).
// Sabotage – Balance: rein mechanisch umgesetzt; Balance via Playtesting.
// =====================================================================

import { colorGroup } from './dice';
import type { PlayerRoll, RolledDie, ScoreBreakdown } from './types';

/** Summe der Werte einer Würfel-Auswahl. */
function sumValues(dice: RolledDie[]): number {
  return dice.reduce((acc, d) => acc + d.value, 0);
}

/**
 * Braun-Wertung: Summe aller braunen Würfel × Größe der größten Gruppe
 * gleicher Augenzahlen. Ohne Match (alle Werte verschieden) ist die größte
 * Gruppe 1 -> Faktor ×1.
 */
export function scoreBrown(brownDice: RolledDie[]): number {
  if (brownDice.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const d of brownDice) {
    counts.set(d.value, (counts.get(d.value) ?? 0) + 1);
  }
  const largestGroup = Math.max(...counts.values());
  return sumValues(brownDice) * largestGroup;
}

/**
 * Zählt die verschiedenen Farb-Wertungsgruppen in einem Wurf. Blau und
 * Blau-Glitzer zählen als eine Gruppe. Orange und Pink zählen mit.
 */
export function countDistinctColors(dice: RolledDie[]): number {
  const groups = new Set<string>();
  for (const d of dice) groups.add(colorGroup(d.def.color));
  return groups.size;
}

/**
 * Orange-Wertung: Summe der Orange-Werte × Anzahl verschiedener Farben,
 * die der Spieler in der Runde gewürfelt hat.
 */
export function scoreOrange(dice: RolledDie[]): number {
  const orange = dice.filter((d) => d.def.color === 'orange');
  if (orange.length === 0) return 0;
  return sumValues(orange) * countDistinctColors(dice);
}

/**
 * „Normale“ Würfel: gelb, grün, blau (+Glitzer), lila, rot, klar, pink.
 * Braun, Orange und Sabotage werden separat behandelt.
 */
const STANDARD_COLORS = new Set([
  'yellow',
  'green',
  'blue',
  'blueGlitter',
  'purple',
  'red',
  'clear',
  'pink',
]);

function scoreStandard(dice: RolledDie[]): number {
  return sumValues(dice.filter((d) => STANDARD_COLORS.has(d.def.color)));
}

function yellowSum(dice: RolledDie[]): number {
  return sumValues(dice.filter((d) => d.def.color === 'yellow'));
}

function sabotageSum(dice: RolledDie[]): number {
  return sumValues(dice.filter((d) => d.def.color === 'sabotage'));
}

/**
 * Wertet eine komplette Runde aus allen Würfen aller Spieler.
 * Liefert je Spieler eine Aufschlüsselung sowie den Kronenhalter.
 */
export function scoreRound(rolls: PlayerRoll[]): {
  breakdowns: ScoreBreakdown[];
  crownPlayerId: string | null;
} {
  // --- 1. Basiswertung je Spieler ----------------------------------
  const breakdowns: ScoreBreakdown[] = rolls.map((r) => {
    const standard = scoreStandard(r.dice);
    const brown = scoreBrown(r.dice.filter((d) => d.def.color === 'brown'));
    const orange = scoreOrange(r.dice);
    const base = standard + brown + orange;
    return {
      playerId: r.playerId,
      standard,
      brown,
      orange,
      base,
      sabotage: 0,
      roundTotal: base,
      distinctColors: countDistinctColors(r.dice),
      yellowSum: yellowSum(r.dice),
      hasCrown: false,
    };
  });

  const byId = new Map(breakdowns.map((b) => [b.playerId, b]));

  // --- 2. Käse-Krone bestimmen -------------------------------------
  // Höchste Gelb-Summe; Tie-Break höhere base-Punkte; dann Reihenfolge.
  let crown: ScoreBreakdown | null = null;
  for (const b of breakdowns) {
    if (b.yellowSum <= 0) continue; // Ohne Gelb keine Krone.
    if (
      crown === null ||
      b.yellowSum > crown.yellowSum ||
      (b.yellowSum === crown.yellowSum && b.base > crown.base)
    ) {
      crown = b;
    }
  }
  if (crown) crown.hasCrown = true;
  const crownPlayerId = crown ? crown.playerId : null;

  // --- 3. Sabotage anwenden ----------------------------------------
  for (const r of rolls) {
    const dmg = sabotageSum(r.dice);
    if (dmg === 0) continue;

    let target: ScoreBreakdown | null = crown;
    // Wirft der Kronenhalter selbst, trifft es den nächstbesten Spieler.
    if (target && target.playerId === r.playerId) {
      target = secondBest(breakdowns, r.playerId);
    }
    // Ohne Krone trifft Sabotage den base-stärksten Gegner.
    if (!target) {
      target = secondBest(breakdowns, r.playerId);
    }
    if (target) {
      const tb = byId.get(target.playerId)!;
      tb.sabotage -= dmg;
    }
  }

  // --- Rundensummen finalisieren -----------------------------------
  for (const b of breakdowns) {
    b.roundTotal = b.base + b.sabotage;
  }

  return { breakdowns, crownPlayerId };
}

/**
 * Liefert den Spieler mit den meisten base-Punkten außer `excludeId`.
 * Tie-Break: „wer in der Runde am meisten gepunktet hat“ ist bereits die
 * base-Punktzahl; bei Gleichstand entscheidet die Spielerreihenfolge.
 */
function secondBest(
  breakdowns: ScoreBreakdown[],
  excludeId: string,
): ScoreBreakdown | null {
  let best: ScoreBreakdown | null = null;
  for (const b of breakdowns) {
    if (b.playerId === excludeId) continue;
    if (best === null || b.base > best.base) best = b;
  }
  return best;
}
