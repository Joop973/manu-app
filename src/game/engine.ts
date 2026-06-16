// =====================================================================
// Spiel-Engine: Zustandsmaschine über 10 Runden mit je vier Phasen.
//
// Reihenfolge der Phasen pro Runde:
//   1. roll  – alle eigenen Würfel werfen
//   2. pity  – Mitleidswürfel an schwächere Spieler verteilen
//   3. swap  – Klar-Würfel tauschen (neu werfen)
//   4. draft – neue Würfel aus dem Angebot wählen
// Nach der Draft-Phase wird die Runde gewertet (scoring.ts) und die
// nächste Runde beginnt, bis `rounds` erreicht ist (-> phase 'finished').
//
// Die Engine ist rein: jede Aktion nimmt einen GameState und liefert einen
// neuen GameState (kein Mutieren des Eingabe-Objekts, kein UI/Netzwerk).
// =====================================================================

import {
  COLOR_LABELS,
  DICE_CATALOG,
  createDie,
  instantiate,
  rollBag,
  rollDie,
} from './dice';
import { createRng } from './rng';
import { scoreRound } from './scoring';
import type {
  BrownPreset,
  DieDefinition,
  GameOptions,
  GameState,
  Player,
  PlayerRoll,
  RolledDie,
} from './types';

export const DEFAULT_OPTIONS: GameOptions = {
  rounds: 10,
  draftSize: 3,
  brownPreset: 'standard',
  seed: 1,
};

export interface PlayerSeed {
  id: string;
  name: string;
  ai?: Player['ai'];
}

/** Tiefe (struktur-)Kopie des Zustands, damit Aktionen rein bleiben. */
function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, bag: p.bag.map((d) => ({ ...d })) })),
    rolls: state.rolls.map((r) => ({
      playerId: r.playerId,
      dice: r.dice.map((d) => ({ value: d.value, def: { ...d.def } })),
    })),
    draft: state.draft
      ? {
          options: state.draft.options.map((d) => ({ ...d })),
          pickOrder: [...state.draft.pickOrder],
        }
      : null,
    history: state.history.map((h) => ({
      ...h,
      breakdowns: h.breakdowns.map((b) => ({ ...b })),
    })),
  };
}

/**
 * Legt ein neues Spiel an. Jede Maus startet mit genau einem gelben W6.
 */
export function createGame(
  seeds: PlayerSeed[],
  options: Partial<GameOptions> = {},
): GameState {
  const opts: GameOptions = { ...DEFAULT_OPTIONS, ...options };
  const players: Player[] = seeds.map((s) => ({
    id: s.id,
    name: s.name,
    ai: s.ai,
    totalScore: 0,
    bag: [createDie('yellow', 6, opts.brownPreset)],
  }));
  return {
    players,
    options: opts,
    round: 1,
    phase: 'roll',
    rolls: [],
    draft: null,
    crownPlayerId: null,
    history: [],
    rngState: opts.seed >>> 0,
  };
}

// --- Phase 1: Würfeln -----------------------------------------------

/** Wirft die Beutel aller Spieler. Übergang roll -> pity. */
export function rollPhase(state: GameState): GameState {
  if (state.phase !== 'roll') throw new Error('rollPhase: falsche Phase');
  const next = clone(state);
  const rng = createRng(next.rngState);
  next.rolls = next.players.map<PlayerRoll>((p) => ({
    playerId: p.id,
    dice: rollBag(p.bag, rng),
  }));
  next.rngState = rng.state();
  next.phase = 'pity';
  return next;
}

// --- Phase 2: Mitleidswürfel ----------------------------------------

/**
 * Verteilt Mitleidswürfel an die schwächeren Spieler. Mechanik (bewusst
 * einfach gehalten, gut testbar, balance-relevant):
 *   - Spieler unter dem Median der Gesamtpunktzahl erhalten je einen
 *     temporären gelben W6, der sofort geworfen und ihrem Wurf der
 *     aktuellen Runde hinzugefügt wird.
 *   - In Runde 1 (alle bei 0) erhält niemand einen Mitleidswürfel.
 * Übergang pity -> swap.
 */
export function pityPhase(state: GameState): GameState {
  if (state.phase !== 'pity') throw new Error('pityPhase: falsche Phase');
  const next = clone(state);
  const rng = createRng(next.rngState);

  const scores = next.players.map((p) => p.totalScore);
  const median = medianOf(scores);
  const everyoneEqual = scores.every((s) => s === scores[0]);

  if (!everyoneEqual) {
    for (const roll of next.rolls) {
      const player = next.players.find((p) => p.id === roll.playerId)!;
      if (player.totalScore < median) {
        const pityDie = createDie('yellow', 6, next.options.brownPreset);
        pityDie.id = `pity-${next.round}-${player.id}`;
        roll.dice.push(rollDie(pityDie, rng));
      }
    }
  }

  next.rngState = rng.state();
  next.phase = 'swap';
  return next;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// --- Phase 3: Klar-Würfel tauschen ----------------------------------

/**
 * Wirft einen Klar-Würfel des Spielers in der aktuellen Runde neu
 * („tauschen“). Mehrfach pro Würfel erlaubt; nur Klar-Würfel zulässig.
 * Bleibt in Phase 'swap'.
 */
export function swapClearDie(
  state: GameState,
  playerId: string,
  dieId: string,
): GameState {
  if (state.phase !== 'swap') throw new Error('swapClearDie: falsche Phase');
  const next = clone(state);
  const rng = createRng(next.rngState);
  const roll = next.rolls.find((r) => r.playerId === playerId);
  if (!roll) throw new Error('swapClearDie: Spieler ohne Wurf');
  const idx = roll.dice.findIndex((d) => d.def.id === dieId);
  if (idx < 0) throw new Error('swapClearDie: Würfel nicht im Wurf');
  if (roll.dice[idx].def.color !== 'clear') {
    throw new Error('swapClearDie: nur Klar-Würfel sind tauschbar');
  }
  roll.dice[idx] = rollDie(roll.dice[idx].def, rng);
  next.rngState = rng.state();
  return next;
}

/** Beendet die Tausch-Phase und erzeugt das Draft-Angebot. swap -> draft. */
export function endSwapPhase(state: GameState): GameState {
  if (state.phase !== 'swap') throw new Error('endSwapPhase: falsche Phase');
  const next = clone(state);
  const rng = createRng(next.rngState);

  const options: DieDefinition[] = [];
  for (let i = 0; i < next.options.draftSize; i++) {
    const bp = DICE_CATALOG[rng.int(0, DICE_CATALOG.length - 1)];
    options.push(instantiate(bp, next.options.brownPreset));
  }
  // Draft-Reihenfolge: schwächster Spieler zuerst (Aufholmechanik).
  const pickOrder = [...next.players]
    .sort((a, b) => a.totalScore - b.totalScore)
    .map((p) => p.id);

  next.draft = { options, pickOrder };
  next.rngState = rng.state();
  next.phase = 'draft';
  return next;
}

// --- Phase 4: Drafting ----------------------------------------------

/**
 * Ein Spieler wählt einen Würfel aus dem Angebot. Der Würfel wandert
 * dauerhaft in seinen Beutel und wird aus dem Angebot entfernt. Es zieht
 * immer der erste Spieler aus `pickOrder`. Bleibt in Phase 'draft', bis
 * alle gezogen haben.
 */
export function draftPick(
  state: GameState,
  playerId: string,
  optionIndex: number,
): GameState {
  if (state.phase !== 'draft' || !state.draft) {
    throw new Error('draftPick: falsche Phase');
  }
  if (state.draft.pickOrder[0] !== playerId) {
    throw new Error('draftPick: Spieler ist nicht am Zug');
  }
  if (optionIndex < 0 || optionIndex >= state.draft.options.length) {
    throw new Error('draftPick: ungültige Auswahl');
  }
  const next = clone(state);
  const picked = next.draft!.options.splice(optionIndex, 1)[0];
  const player = next.players.find((p) => p.id === playerId)!;
  // Neue Instanz-ID, falls der gezogene Würfel im Beutel landen soll.
  player.bag.push({ ...picked });
  next.draft!.pickOrder.shift();
  return next;
}

/**
 * Ein Spieler verzichtet auf einen Draft (kein Würfel passt / Angebot leer).
 */
export function draftSkip(state: GameState, playerId: string): GameState {
  if (state.phase !== 'draft' || !state.draft) {
    throw new Error('draftSkip: falsche Phase');
  }
  if (state.draft.pickOrder[0] !== playerId) {
    throw new Error('draftSkip: Spieler ist nicht am Zug');
  }
  const next = clone(state);
  next.draft!.pickOrder.shift();
  return next;
}

/**
 * Schließt die Draft-Phase ab, wertet die Runde, schreibt Gesamtpunkte fort
 * und startet die nächste Runde (oder beendet das Spiel). draft -> roll
 * bzw. -> finished.
 */
export function endRound(state: GameState): GameState {
  if (state.phase !== 'draft' || !state.draft) {
    throw new Error('endRound: falsche Phase');
  }
  if (state.draft.pickOrder.length > 0) {
    throw new Error('endRound: es müssen noch Spieler draften');
  }
  const next = clone(state);

  const { breakdowns, crownPlayerId } = scoreRound(next.rolls);
  for (const b of breakdowns) {
    const player = next.players.find((p) => p.id === b.playerId)!;
    player.totalScore += b.roundTotal;
  }
  next.history.push({ round: next.round, breakdowns, crownPlayerId });
  next.crownPlayerId = crownPlayerId;
  next.draft = null;
  next.rolls = [];

  if (next.round >= next.options.rounds) {
    next.phase = 'finished';
  } else {
    next.round += 1;
    next.phase = 'roll';
  }
  return next;
}

// --- Auswertung des Spielendes --------------------------------------

export interface GameResult {
  /** Sieger = höchste Gesamtpunktzahl. Tie-Break: Kronenhalter, dann Reihenfolge. */
  winnerId: string;
  ranking: { playerId: string; totalScore: number }[];
}

/** Liefert das Endergebnis eines beendeten Spiels. */
export function gameResult(state: GameState): GameResult {
  if (state.phase !== 'finished') {
    throw new Error('gameResult: Spiel ist noch nicht beendet');
  }
  const ranking = [...state.players]
    .map((p) => ({ playerId: p.id, totalScore: p.totalScore }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.playerId === state.crownPlayerId) return -1;
      if (b.playerId === state.crownPlayerId) return 1;
      return 0;
    });
  return { winnerId: ranking[0].playerId, ranking };
}

// --- Komfort: Helfer für UI/KI --------------------------------------

/** Klar-Würfel im aktuellen Wurf eines Spielers (für die Tausch-Phase). */
export function clearDiceOf(state: GameState, playerId: string): RolledDie[] {
  const roll = state.rolls.find((r) => r.playerId === playerId);
  if (!roll) return [];
  return roll.dice.filter((d) => d.def.color === 'clear');
}

/** Wer ist gerade mit Draften an der Reihe? */
export function currentDrafter(state: GameState): string | null {
  return state.draft?.pickOrder[0] ?? null;
}

/** Menschlich lesbare Beschreibung eines Würfels, z. B. „Gelb W6“. */
export function describeDie(def: DieDefinition): string {
  return `${COLOR_LABELS[def.color]} W${def.sides}`;
}

export { COLOR_LABELS } from './dice';
export type { BrownPreset };
