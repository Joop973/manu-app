// =====================================================================
// KI-Gegner (Phase 3).
//
// Bewusst als REINE Entscheidungsfunktionen gekapselt: Eingang ist immer
// (GameState, playerId, Difficulty), Ausgang sind Engine-Aktionen bzw. ein
// neuer GameState über die normalen Engine-Funktionen. Dadurch lässt sich
// dieselbe KI später serverseitig für Spielerausfälle im Online-Modus
// einsetzen (Timeout -> KI übernimmt einen Zug).
//
// Schwierigkeitsgrade unterscheiden sich über die Heuristik (nicht über
// Zufall) – das macht die KI deterministisch und gut testbar:
//   easy   – nur roher Erwartungswert eines Würfels
//   normal – zusätzlich Käse-Kronen-Bonus (Gelb) und Klar-Wiederwurf-Bonus
//   hard   – zusätzlich Synergien: Orange (Farbvielfalt), Braun (Gruppen),
//            Sabotage (höher bewertet, wenn die KI führt)
// =====================================================================

import { colorGroup } from './dice';
import { swapClearDie, draftPick, draftSkip, currentDrafter } from './engine';
import type {
  DieDefinition,
  Difficulty,
  GameState,
  Player,
  RolledDie,
} from './types';

/** Erwartungswert eines einzelnen Würfels (berücksichtigt explizite Faces). */
export function dieExpectedValue(def: DieDefinition): number {
  if (def.faces && def.faces.length > 0) {
    return def.faces.reduce((a, b) => a + b, 0) / def.faces.length;
  }
  return (def.sides + 1) / 2;
}

/** Verschiedene Farb-Wertungsgruppen in einem Beutel (Blau+Glitzer = eine). */
function distinctGroups(bag: DieDefinition[]): number {
  const set = new Set<string>();
  for (const d of bag) set.add(colorGroup(d.color));
  return set.size;
}

/**
 * Bewertet einen angebotenen Würfel im Kontext des aktuellen Beutels.
 * Höher = attraktiver. Die Schwierigkeit steuert, wie viele Aspekte
 * einfließen.
 */
export function evaluateDraftOption(
  def: DieDefinition,
  player: Player,
  state: GameState,
  difficulty: Difficulty,
): number {
  const bag = player.bag;
  let score = dieExpectedValue(def);

  if (difficulty === 'easy') return score;

  // normal + hard: Käse-Kronen-Bonus für Gelb, Bonus für tauschbares Klar.
  if (def.color === 'yellow') score += 0.75;
  if (def.color === 'clear') score += 0.5; // neu werfbar -> leicht besser

  if (difficulty === 'normal') return score;

  // hard: Synergien.
  switch (def.color) {
    case 'orange': {
      // Orange skaliert mit der Farbvielfalt im Beutel (inkl. Orange selbst).
      const groups = distinctGroups([...bag, def]);
      score = dieExpectedValue(def) * Math.max(1, groups);
      break;
    }
    case 'brown': {
      // Braun skaliert mit bereits vorhandenen braunen Würfeln (Gruppen).
      const browns = bag.filter((d) => d.color === 'brown').length;
      score = dieExpectedValue(def) * (browns + 1);
      break;
    }
    case 'sabotage': {
      // Sabotage ist Denial; wertvoller, wenn die KI vorne liegt.
      const leading = isLeading(player, state);
      score = dieExpectedValue(def) * (leading ? 1.3 : 0.9);
      break;
    }
    default:
      break;
  }
  return score;
}

/** Liegt der Spieler bei der Gesamtpunktzahl (mindestens gleichauf) vorne? */
function isLeading(player: Player, state: GameState): boolean {
  const max = Math.max(...state.players.map((p) => p.totalScore));
  return player.totalScore >= max;
}

/**
 * Wählt den besten Draft-Index für einen Spieler. Liefert `null`, wenn das
 * Angebot leer ist (dann sollte übersprungen werden).
 */
export function chooseDraftOption(
  state: GameState,
  playerId: string,
  difficulty: Difficulty,
): number | null {
  const draft = state.draft;
  if (!draft || draft.options.length === 0) return null;
  const player = state.players.find((p) => p.id === playerId)!;
  let bestIdx = 0;
  let bestScore = -Infinity;
  draft.options.forEach((opt, i) => {
    const s = evaluateDraftOption(opt, player, state, difficulty);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  return bestIdx;
}

/** Schwellwert: Klar-Würfel werden unter diesem Wert (inklusive) neu geworfen. */
function swapThreshold(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 1;
    case 'normal':
      return 2;
    case 'hard':
      return 3; // alles unter dem Mittelwert eines W6 neu werfen
  }
}

/**
 * Welche Klar-Würfel würde die KI tauschen? Liefert die Würfel-IDs der
 * Klar-Würfel, deren Wert unter dem Schwellwert liegt.
 */
export function chooseClearSwaps(
  state: GameState,
  playerId: string,
  difficulty: Difficulty,
): string[] {
  const roll = state.rolls.find((r) => r.playerId === playerId);
  if (!roll) return [];
  const t = swapThreshold(difficulty);
  return roll.dice
    .filter((d: RolledDie) => d.def.color === 'clear' && d.value <= t)
    .map((d) => d.def.id);
}

// --- Aktionen anwenden (über die Engine) ----------------------------

/** Wendet alle Klar-Tausch-Entscheidungen der KI in der swap-Phase an. */
export function aiTakeSwapTurn(
  state: GameState,
  playerId: string,
  difficulty: Difficulty,
): GameState {
  let next = state;
  for (const dieId of chooseClearSwaps(state, playerId, difficulty)) {
    next = swapClearDie(next, playerId, dieId);
  }
  return next;
}

/**
 * Lässt die KI ihren Draft-Zug machen, sofern sie an der Reihe ist.
 * Gibt den unveränderten Zustand zurück, wenn die KI nicht dran ist.
 */
export function aiTakeDraftTurn(
  state: GameState,
  difficulty: Difficulty,
): GameState {
  const playerId = currentDrafter(state);
  if (!playerId) return state;
  const idx = chooseDraftOption(state, playerId, difficulty);
  return idx === null
    ? draftSkip(state, playerId)
    : draftPick(state, playerId, idx);
}
