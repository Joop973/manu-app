import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame,
  rollPhase,
  pityPhase,
  swapClearDie,
  endSwapPhase,
  draftPick,
  draftSkip,
  endRound,
  gameResult,
  currentDrafter,
  clearDiceOf,
} from '../engine';
import { resetDieIds, createDie } from '../dice';

beforeEach(() => resetDieIds());

const seeds = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];

describe('createGame', () => {
  it('jede Maus startet mit genau einem gelben W6', () => {
    const g = createGame(seeds);
    for (const p of g.players) {
      expect(p.bag).toHaveLength(1);
      expect(p.bag[0].color).toBe('yellow');
      expect(p.bag[0].sides).toBe(6);
    }
    expect(g.round).toBe(1);
    expect(g.phase).toBe('roll');
  });

  it('Standard sind 10 Runden', () => {
    expect(createGame(seeds).options.rounds).toBe(10);
  });
});

describe('Phasen-Reihenfolge', () => {
  it('roll -> pity -> swap -> draft und ist deterministisch beim Seed', () => {
    const g1 = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 42 }))));
    resetDieIds();
    const g2 = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 42 }))));
    expect(g1.phase).toBe('draft');
    expect(g1.rolls).toEqual(g2.rolls); // gleicher Seed -> gleiche Würfe
  });

  it('falsche Phase wirft einen Fehler', () => {
    const g = createGame(seeds);
    expect(() => pityPhase(g)).toThrow();
  });
});

describe('pityPhase – Mitleidswürfel', () => {
  it('vergibt in Runde 1 (alle bei 0) keine Mitleidswürfel', () => {
    const g = pityPhase(rollPhase(createGame(seeds, { seed: 7 })));
    for (const r of g.rolls) {
      expect(r.dice.every((d) => !d.def.id.startsWith('pity-'))).toBe(true);
    }
  });

  it('schwächerer Spieler (unter Median) erhält einen Mitleidswürfel', () => {
    const g = createGame(seeds, { seed: 7 });
    g.players[0].totalScore = 0;  // schwächer
    g.players[1].totalScore = 50; // stärker
    const rolled = pityPhase(rollPhase(g));
    const aDice = rolled.rolls.find((r) => r.playerId === 'a')!.dice;
    const bDice = rolled.rolls.find((r) => r.playerId === 'b')!.dice;
    expect(aDice.some((d) => d.def.id.startsWith('pity-'))).toBe(true);
    expect(bDice.some((d) => d.def.id.startsWith('pity-'))).toBe(false);
  });
});

describe('swapClearDie – Klar-Würfel tauschen', () => {
  it('tauscht nur Klar-Würfel und bleibt in der swap-Phase', () => {
    const g = createGame(seeds, { seed: 3 });
    g.players[0].bag.push(createDie('clear', 6));
    const swapPhase = pityPhase(rollPhase(g));
    const clearDie = clearDiceOf(swapPhase, 'a')[0];
    expect(clearDie).toBeDefined();
    const after = swapClearDie(swapPhase, 'a', clearDie.def.id);
    expect(after.phase).toBe('swap');
  });

  it('verweigert das Tauschen eines Nicht-Klar-Würfels', () => {
    const swapPhase = pityPhase(rollPhase(createGame(seeds, { seed: 3 })));
    const yellow = swapPhase.rolls[0].dice[0];
    expect(() => swapClearDie(swapPhase, 'a', yellow.def.id)).toThrow();
  });
});

describe('draft – Drafting', () => {
  it('schwächster Spieler draftet zuerst, gewählter Würfel landet im Beutel', () => {
    const g = createGame(seeds, { seed: 5 });
    g.players[0].totalScore = 30;
    g.players[1].totalScore = 0; // b ist schwächer -> zuerst
    const draft = endSwapPhase(pityPhase(rollPhase(g)));
    expect(currentDrafter(draft)).toBe('b');

    const bBagBefore = draft.players.find((p) => p.id === 'b')!.bag.length;
    const afterB = draftPick(draft, 'b', 0);
    const bBagAfter = afterB.players.find((p) => p.id === 'b')!.bag.length;
    expect(bBagAfter).toBe(bBagBefore + 1);
    expect(currentDrafter(afterB)).toBe('a');
  });

  it('Spieler, der nicht am Zug ist, kann nicht draften', () => {
    const draft = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 5 }))));
    const notCurrent = draft.players.find((p) => p.id !== currentDrafter(draft))!.id;
    expect(() => draftPick(draft, notCurrent, 0)).toThrow();
  });

  it('draftSkip überspringt den Zug', () => {
    const draft = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 5 }))));
    const first = currentDrafter(draft)!;
    const after = draftSkip(draft, first);
    expect(currentDrafter(after)).not.toBe(first);
  });
});

describe('endRound – Wertung und Rundenwechsel', () => {
  function playRound(state: ReturnType<typeof createGame>) {
    let s = endSwapPhase(pityPhase(rollPhase(state)));
    // Alle Spieler überspringen den Draft für einen deterministischen Test.
    while (currentDrafter(s)) s = draftSkip(s, currentDrafter(s)!);
    return endRound(s);
  }

  it('schreibt Gesamtpunkte fort und erhöht die Runde', () => {
    const g = createGame(seeds, { seed: 11 });
    const after = playRound(g);
    expect(after.round).toBe(2);
    expect(after.phase).toBe('roll');
    expect(after.history).toHaveLength(1);
    const sumTotals = after.players.reduce((acc, p) => acc + p.totalScore, 0);
    const sumRound = after.history[0].breakdowns.reduce(
      (acc, b) => acc + b.roundTotal,
      0,
    );
    expect(sumTotals).toBe(sumRound);
  });

  it('nach `rounds` Runden ist das Spiel beendet', () => {
    let g = createGame(seeds, { seed: 11, rounds: 3 });
    for (let i = 0; i < 3; i++) g = playRound(g);
    expect(g.phase).toBe('finished');
    const result = gameResult(g);
    expect(result.ranking).toHaveLength(2);
    // Sieger hat die höchste Gesamtpunktzahl.
    expect(result.ranking[0].totalScore).toBeGreaterThanOrEqual(
      result.ranking[1].totalScore,
    );
  });

  it('gameResult wirft, solange das Spiel läuft', () => {
    expect(() => gameResult(createGame(seeds))).toThrow();
  });
});

describe('Reinheit – Aktionen mutieren den Eingabezustand nicht', () => {
  it('rollPhase verändert das Original nicht', () => {
    const g = createGame(seeds, { seed: 9 });
    const before = JSON.stringify(g);
    rollPhase(g);
    expect(JSON.stringify(g)).toBe(before);
  });
});
