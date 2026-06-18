// =====================================================================
// Würfelkatalog: Definitionen aller Farben, Face-Werte und Würfeln.
//
// Der vollständige Katalog laut Spielregeln. Face-Werte für Rot und Braun
// sind absichtlich konfigurierbar gehalten (Playtesting/Balance).
// =====================================================================

import type {
  BrownPreset,
  ColorGroup,
  DieColor,
  DieDefinition,
  RolledDie,
} from './types';
import type { Rng } from './rng';

let idCounter = 0;
/** Vergibt eine eindeutige Instanz-ID für einen Würfel. */
export function nextDieId(prefix = 'die'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Für Tests: ID-Zähler zurücksetzen, damit IDs vorhersehbar sind. */
export function resetDieIds(): void {
  idCounter = 0;
}

// --- Konfigurierbare Face-Werte -------------------------------------

/**
 * Rote Würfel haben positive UND negative Faces. Werte sind als sinnvolle
 * Standardbalance gewählt und an einer Stelle änderbar.
 */
export const RED_FACES: Record<number, number[]> = {
  6: [-3, -2, -1, 1, 2, 3],
  8: [-4, -3, -2, -1, 1, 2, 3, 4],
};

/**
 * Braun-Faces je Variante (W6). Standard {2,3}; Alternativen {1,2} und
 * {1,2,3} für Playtesting. Mehrfache Werte erhöhen die Match-Chance.
 */
export const BROWN_PRESETS: Record<BrownPreset, number[]> = {
  standard: [2, 2, 2, 3, 3, 3],
  low: [1, 1, 1, 2, 2, 2],
  wide: [1, 1, 2, 2, 3, 3],
};

/** Orange ist ein W3. */
const ORANGE_FACES = [1, 2, 3];

// --- Farb-Wertungsgruppen -------------------------------------------

/**
 * Liefert die Wertungsgruppe einer Farbe. Blau und Blau-Glitzer teilen
 * sich die Gruppe `blue` (zählen für Orange als eine Farbe).
 */
export function colorGroup(color: DieColor): ColorGroup {
  return color === 'blueGlitter' ? 'blue' : color;
}

// --- Faktory-Funktionen ---------------------------------------------

/** Erzeugt einen Würfel definierter Farbe/Seitenzahl mit korrekten Faces. */
export function createDie(
  color: DieColor,
  sides: number,
  brownPreset: BrownPreset = 'standard',
): DieDefinition {
  const def: DieDefinition = { id: nextDieId(color), color, sides };
  if (color === 'red') {
    def.faces = RED_FACES[sides] ?? defaultRedFaces(sides);
  } else if (color === 'brown') {
    def.faces = BROWN_PRESETS[brownPreset];
    def.sides = def.faces.length;
  } else if (color === 'orange') {
    def.faces = ORANGE_FACES;
    def.sides = 3;
  }
  return def;
}

/** Fallback, falls eine ungewöhnliche rote Seitenzahl angefragt wird. */
function defaultRedFaces(sides: number): number[] {
  const half = Math.floor(sides / 2);
  const faces: number[] = [];
  for (let i = half; i >= 1; i--) faces.push(-i);
  for (let i = 1; i <= sides - half; i++) faces.push(i);
  return faces;
}

// --- Würfeln ---------------------------------------------------------

/** Würfelt einen einzelnen Würfel mit dem gegebenen RNG. */
export function rollDie(def: DieDefinition, rng: Rng): RolledDie {
  if (def.faces && def.faces.length > 0) {
    const idx = rng.int(0, def.faces.length - 1);
    return { def, value: def.faces[idx] };
  }
  return { def, value: rng.int(1, def.sides) };
}

/** Würfelt alle Würfel eines Beutels. */
export function rollBag(bag: DieDefinition[], rng: Rng): RolledDie[] {
  return bag.map((d) => rollDie(d, rng));
}

// --- Katalog der draftbaren Würfel ----------------------------------

/**
 * Bauplan eines draftbaren Würfels (Farbe + Seitenzahl). Alle Farben –
 * inklusive Orange, Sabotage und Braun – sind regulär draftbar.
 */
export interface DiceBlueprint {
  color: DieColor;
  sides: number;
}

export const DICE_CATALOG: DiceBlueprint[] = [
  { color: 'yellow', sides: 6 },
  { color: 'yellow', sides: 8 },
  { color: 'green', sides: 20 },
  { color: 'blue', sides: 6 },
  { color: 'blue', sides: 8 },
  { color: 'blue', sides: 12 },
  { color: 'blueGlitter', sides: 6 },
  { color: 'blueGlitter', sides: 8 },
  { color: 'blueGlitter', sides: 12 },
  { color: 'purple', sides: 8 },
  { color: 'purple', sides: 12 },
  { color: 'red', sides: 6 },
  { color: 'red', sides: 8 },
  { color: 'clear', sides: 6 },
  { color: 'pink', sides: 12 },
  { color: 'orange', sides: 3 },
  { color: 'sabotage', sides: 8 },
  { color: 'sabotage', sides: 12 },
  { color: 'brown', sides: 6 },
];

/** Erzeugt aus einem Bauplan eine konkrete Würfel-Instanz. */
export function instantiate(
  bp: DiceBlueprint,
  brownPreset: BrownPreset = 'standard',
): DieDefinition {
  return createDie(bp.color, bp.sides, brownPreset);
}

/** Lesbare deutsche Bezeichnung einer Farbe (für UI/Logs). */
export const COLOR_LABELS: Record<DieColor, string> = {
  yellow: 'Gelb',
  green: 'Grün',
  blue: 'Blau',
  blueGlitter: 'Blau-Glitzer',
  purple: 'Lila',
  red: 'Rot',
  clear: 'Klar',
  pink: 'Pink',
  orange: 'Orange',
  sabotage: 'Sabotage',
  brown: 'Braun',
};
