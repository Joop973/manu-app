import { describe, it, expect } from 'vitest';
import {
  scoreBrown,
  scoreOrange,
  scoreRound,
  countDistinctColors,
} from '../scoring';
import type { DieColor, PlayerRoll, RolledDie } from '../types';

// Hilfsfunktion: erzeugt einen geworfenen Würfel ohne RNG (fester Wert).
function rd(color: DieColor, value: number, sides = 6, id = `${color}-${value}`): RolledDie {
  return { def: { id, color, sides }, value };
}

function roll(playerId: string, dice: RolledDie[]): PlayerRoll {
  return { playerId, dice };
}

describe('scoreBrown – Summe × größte passende Gruppe', () => {
  it('ohne braune Würfel = 0', () => {
    expect(scoreBrown([])).toBe(0);
  });

  it('alle Werte verschieden -> Faktor ×1', () => {
    // Werte 2 + 3 = 5, größte Gruppe 1 -> 5
    expect(scoreBrown([rd('brown', 2), rd('brown', 3)])).toBe(5);
  });

  it('Dreiergruppe -> Faktor ×3', () => {
    // 2+2+2 = 6, größte Gruppe 3 -> 18
    expect(scoreBrown([rd('brown', 2), rd('brown', 2), rd('brown', 2)])).toBe(18);
  });

  it('größte von mehreren Gruppen zählt', () => {
    // Werte 3,3,3,2,2 -> Summe 13, größte Gruppe 3 -> 39
    const dice = [
      rd('brown', 3),
      rd('brown', 3),
      rd('brown', 3),
      rd('brown', 2),
      rd('brown', 2),
    ];
    expect(scoreBrown(dice)).toBe(39);
  });
});

describe('countDistinctColors – Blau & Blau-Glitzer = eine Farbe', () => {
  it('Blau und Blau-Glitzer zählen als eine Farbe', () => {
    const dice = [rd('blue', 4), rd('blueGlitter', 5)];
    expect(countDistinctColors(dice)).toBe(1);
  });

  it('zählt verschiedene Gruppen inkl. Orange und Pink', () => {
    const dice = [
      rd('orange', 2, 3),
      rd('pink', 7, 12),
      rd('blue', 3),
      rd('blueGlitter', 1),
      rd('green', 10, 20),
    ];
    // Gruppen: orange, pink, blue, green -> 4
    expect(countDistinctColors(dice)).toBe(4);
  });
});

describe('scoreOrange – Wert × Anzahl verschiedener Farben', () => {
  it('ohne Orange = 0', () => {
    expect(scoreOrange([rd('green', 10, 20)])).toBe(0);
  });

  it('Orange-Wert × Farbanzahl (Orange & Pink mitgezählt)', () => {
    const dice = [
      rd('orange', 3, 3),
      rd('pink', 5, 12),
      rd('green', 8, 20),
    ];
    // 3 Farben (orange, pink, green) × Orange-Summe 3 = 9
    expect(scoreOrange(dice)).toBe(9);
  });

  it('mehrere Orange-Würfel summieren ihren Wert', () => {
    const dice = [rd('orange', 2, 3), rd('orange', 3, 3), rd('blue', 4)];
    // Orange-Summe 5, Farben (orange, blue) = 2 -> 10
    expect(scoreOrange(dice)).toBe(10);
  });
});

describe('scoreRound – Standardsumme, Rot mit negativen Werten', () => {
  it('summiert normale Würfel inkl. negativer Rot-Werte', () => {
    const rolls = [
      roll('p1', [rd('green', 10, 20), rd('red', -3, 6), rd('purple', 5, 8)]),
    ];
    const { breakdowns } = scoreRound(rolls);
    // 10 - 3 + 5 = 12
    expect(breakdowns[0].standard).toBe(12);
    expect(breakdowns[0].base).toBe(12);
  });
});

describe('scoreRound – Käse-Krone', () => {
  it('höchste Gelb-Summe bekommt die Krone', () => {
    const rolls = [
      roll('p1', [rd('yellow', 4)]),
      roll('p2', [rd('yellow', 6), rd('yellow', 2, 8)]),
    ];
    const { crownPlayerId, breakdowns } = scoreRound(rolls);
    expect(crownPlayerId).toBe('p2');
    expect(breakdowns.find((b) => b.playerId === 'p2')!.hasCrown).toBe(true);
    expect(breakdowns.find((b) => b.playerId === 'p1')!.hasCrown).toBe(false);
  });

  it('Tie-Break bei gleicher Gelb-Summe: höhere base-Punkte', () => {
    const rolls = [
      roll('p1', [rd('yellow', 5), rd('green', 2, 20)]),
      roll('p2', [rd('yellow', 5), rd('green', 9, 20)]),
    ];
    const { crownPlayerId } = scoreRound(rolls);
    expect(crownPlayerId).toBe('p2');
  });

  it('ohne Gelb keine Krone', () => {
    const rolls = [roll('p1', [rd('green', 10, 20)])];
    const { crownPlayerId } = scoreRound(rolls);
    expect(crownPlayerId).toBeNull();
  });
});

describe('scoreRound – Sabotage', () => {
  it('zieht die Sabotage-Summe dem Kronenhalter ab', () => {
    const rolls = [
      roll('crown', [rd('yellow', 6)]), // hält die Krone
      roll('saboteur', [rd('sabotage', 5, 8), rd('sabotage', 3, 12)]),
    ];
    const { breakdowns } = scoreRound(rolls);
    const crown = breakdowns.find((b) => b.playerId === 'crown')!;
    // base 6, Sabotage -8 -> -2
    expect(crown.sabotage).toBe(-8);
    expect(crown.roundTotal).toBe(-2);
  });

  it('trifft den Zweitplatzierten, wenn der Werfer selbst die Krone hält', () => {
    const rolls = [
      // Kronenhalter wirft selbst Sabotage:
      roll('crown', [rd('yellow', 9), rd('sabotage', 4, 8)]),
      roll('second', [rd('yellow', 2), rd('green', 12, 20)]),
      roll('third', [rd('yellow', 1), rd('green', 1, 20)]),
    ];
    const { breakdowns, crownPlayerId } = scoreRound(rolls);
    expect(crownPlayerId).toBe('crown');
    const second = breakdowns.find((b) => b.playerId === 'second')!;
    const third = breakdowns.find((b) => b.playerId === 'third')!;
    // 'second' hat die höhere base-Punktzahl -> wird getroffen
    expect(second.sabotage).toBe(-4);
    expect(third.sabotage).toBe(0);
  });

  it('Werte dürfen negativ werden', () => {
    const rolls = [
      roll('crown', [rd('yellow', 1)]),
      roll('saboteur', [rd('sabotage', 12, 12)]),
    ];
    const { breakdowns } = scoreRound(rolls);
    expect(breakdowns.find((b) => b.playerId === 'crown')!.roundTotal).toBe(-11);
  });
});

describe('scoreRound – kombinierte Wertung', () => {
  it('Standard + Braun + Orange ergeben base', () => {
    const rolls = [
      roll('p1', [
        rd('green', 5, 20),       // standard 5
        rd('brown', 3),
        rd('brown', 3),           // brown 6 × Gruppe 2 = 12
        rd('orange', 2, 3),       // orange 2 × 3 Farben (green, brown, orange) = 6
      ]),
    ];
    const { breakdowns } = scoreRound(rolls);
    const b = breakdowns[0];
    expect(b.standard).toBe(5);
    expect(b.brown).toBe(12);
    expect(b.orange).toBe(6);
    expect(b.base).toBe(23);
    expect(b.roundTotal).toBe(23);
  });
});
