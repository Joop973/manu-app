import { describe, it, expect, beforeEach } from 'vitest';
import {
  dieExpectedValue,
  evaluateDraftOption,
  chooseDraftOption,
  chooseClearSwaps,
  aiTakeDraftTurn,
} from '../ai';
import {
  createGame,
  rollPhase,
  pityPhase,
  endSwapPhase,
  currentDrafter,
} from '../engine';
import { createDie, resetDieIds } from '../dice';
import type { GameState } from '../types';

beforeEach(() => resetDieIds());

const seeds = [
  { id: 'human', name: 'Mensch' },
  { id: 'ai', name: 'KI', ai: 'hard' as const },
];

describe('dieExpectedValue', () => {
  it('berechnet den EV eines Standardwürfels', () => {
    expect(dieExpectedValue(createDie('green', 20))).toBe(10.5);
    expect(dieExpectedValue(createDie('yellow', 6))).toBe(3.5);
  });

  it('berücksichtigt explizite (negative) Faces bei Rot', () => {
    // Rot W6 Faces [-3,-2,-1,1,2,3] -> EV 0
    expect(dieExpectedValue(createDie('red', 6))).toBe(0);
  });
});

describe('evaluateDraftOption – Schwierigkeitsgrade', () => {
  it('bevorzugt höheren EV (grün W20 vor rot W6)', () => {
    const state = createGame(seeds);
    const player = state.players[0];
    const green = evaluateDraftOption(createDie('green', 20), player, state, 'easy');
    const red = evaluateDraftOption(createDie('red', 6), player, state, 'easy');
    expect(green).toBeGreaterThan(red);
  });

  it('hard bewertet Orange höher in einem farbvielfältigen Beutel', () => {
    const state = createGame(seeds);
    const player = state.players[0];
    // Beutel künstlich mit verschiedenen Farben füllen.
    player.bag.push(createDie('green', 20));
    player.bag.push(createDie('pink', 12));
    player.bag.push(createDie('purple', 8));
    const orange = createDie('orange', 3);
    const hard = evaluateDraftOption(orange, player, state, 'hard');
    const easy = evaluateDraftOption(orange, player, state, 'easy');
    expect(hard).toBeGreaterThan(easy);
  });

  it('hard bewertet Braun höher, je mehr braune Würfel schon im Beutel sind', () => {
    const state = createGame(seeds);
    const player = state.players[0];
    const before = evaluateDraftOption(createDie('brown', 6), player, state, 'hard');
    player.bag.push(createDie('brown', 6));
    player.bag.push(createDie('brown', 6));
    const after = evaluateDraftOption(createDie('brown', 6), player, state, 'hard');
    expect(after).toBeGreaterThan(before);
  });
});

describe('chooseDraftOption', () => {
  it('wählt den Würfel mit dem höchsten Score', () => {
    let state: GameState = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 5 }))));
    // Angebot bekannt machen: ersetze Optionen deterministisch.
    state = {
      ...state,
      draft: {
        ...state.draft!,
        options: [createDie('red', 6), createDie('green', 20), createDie('yellow', 6)],
      },
    };
    const drafter = currentDrafter(state)!;
    const idx = chooseDraftOption(state, drafter, 'normal');
    expect(idx).not.toBeNull();
    expect(state.draft!.options[idx!].color).toBe('green'); // höchster EV
  });

  it('liefert null bei leerem Angebot', () => {
    let state: GameState = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 5 }))));
    state = { ...state, draft: { ...state.draft!, options: [] } };
    expect(chooseDraftOption(state, currentDrafter(state)!, 'easy')).toBeNull();
  });
});

describe('chooseClearSwaps – Schwellwert je Schwierigkeit', () => {
  it('tauscht niedrige Klar-Würfel, behält hohe', () => {
    const g = createGame(seeds, { seed: 3 });
    g.players[1].bag.push(createDie('clear', 6));
    const swapState = pityPhase(rollPhase(g));
    // Den Klar-Würfel-Wert künstlich setzen, um den Schwellwert zu prüfen.
    const roll = swapState.rolls.find((r) => r.playerId === 'ai')!;
    const clear = roll.dice.find((d) => d.def.color === 'clear')!;
    clear.value = 1;
    expect(chooseClearSwaps(swapState, 'ai', 'easy')).toContain(clear.def.id);
    clear.value = 5;
    expect(chooseClearSwaps(swapState, 'ai', 'hard')).not.toContain(clear.def.id);
  });
});

describe('aiTakeDraftTurn – vollständiger KI-Zug', () => {
  it('reduziert das Angebot und gibt den Zug weiter', () => {
    const draft = endSwapPhase(pityPhase(rollPhase(createGame(seeds, { seed: 5 }))));
    const before = draft.draft!.options.length;
    const drafterBefore = currentDrafter(draft);
    const after = aiTakeDraftTurn(draft, 'hard');
    expect(after.draft!.options.length).toBe(before - 1);
    expect(currentDrafter(after)).not.toBe(drafterBefore);
  });
});
