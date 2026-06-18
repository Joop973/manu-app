// =====================================================================
// Dice Mice – zentrale Typen der Spiel-Engine.
//
// Diese Datei enthält NUR Typen/Interfaces. Die Engine (engine.ts),
// die Wertung (scoring.ts) und der Würfelkatalog (dice.ts) bauen darauf
// auf. Es gibt hier bewusst keinerlei UI- oder Netzwerk-Bezug:
// dieselbe Engine läuft lokal (Pass-and-Play, Solo gegen KI) und später
// serverseitig im Online-Modus.
// =====================================================================

/** Alle Würfelfarben. `blueGlitter` ist die Glitzer-Variante von Blau. */
export type DieColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'blueGlitter'
  | 'purple'
  | 'red'
  | 'clear'
  | 'pink'
  | 'orange'
  | 'sabotage'
  | 'brown';

/**
 * Wertungsgruppe einer Farbe. Für die Orange-Wertung zählen Blau und
 * Blau-Glitzer als **eine** Farbe – beide haben deshalb dieselbe Gruppe.
 */
export type ColorGroup = Exclude<DieColor, 'blueGlitter'>;

/**
 * Definition eines Würfels im Beutel. Der Beutel ist eine Liste solcher
 * Definitionen (Farbe + Seiten), nicht „eine Farbe = ein Würfel“ – ein
 * Spieler kann mehrere Würfel derselben Farbe besitzen.
 */
export interface DieDefinition {
  /** Eindeutige Instanz-ID (ein konkreter Würfel im Beutel). */
  id: string;
  color: DieColor;
  /** Seitenzahl (W6 = 6, W20 = 20 …). */
  sides: number;
  /**
   * Explizite Seitenwerte. Wenn gesetzt, werden ausschließlich diese
   * Werte gewürfelt (für Rot mit negativen Werten und für Braun mit
   * konfigurierbaren Faces). Sonst gilt 1..sides.
   */
  faces?: number[];
}

/** Ein geworfener Würfel mit konkretem Ergebnis. */
export interface RolledDie {
  def: DieDefinition;
  value: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Player {
  id: string;
  name: string;
  /** Der Würfelbeutel des Spielers (bleibt über Runden erhalten). */
  bag: DieDefinition[];
  /** Aufsummierte Gesamtpunktzahl über alle bisherigen Runden. */
  totalScore: number;
  /** Steuert die KI; bei menschlichen Spielern undefined. */
  ai?: Difficulty;
}

/** Die vier Phasen einer Runde, in fester Reihenfolge. */
export type Phase = 'roll' | 'pity' | 'swap' | 'draft' | 'finished';

/** Geworfene Würfel eines Spielers in der aktuellen Runde. */
export interface PlayerRoll {
  playerId: string;
  dice: RolledDie[];
}

/** Aufschlüsselung der Wertung eines Spielers in einer Runde. */
export interface ScoreBreakdown {
  playerId: string;
  /** Summe der „normalen“ Würfel (gelb, grün, blau, lila, rot, klar, pink). */
  standard: number;
  /** Braun-Beitrag (Summe × größte passende Gruppe). */
  brown: number;
  /** Orange-Beitrag (Wert × Anzahl verschiedener Farben). */
  orange: number;
  /** Summe vor Sabotage (standard + brown + orange). */
  base: number;
  /** Sabotage-Korrektur (negativ, falls dieser Spieler getroffen wurde). */
  sabotage: number;
  /** Rundenpunkte = base + sabotage (darf negativ sein). */
  roundTotal: number;
  /** Anzahl verschiedener Farben, die der Spieler in der Runde gewürfelt hat. */
  distinctColors: number;
  /** Summe der gelben Würfel (für die Käse-Krone). */
  yellowSum: number;
  /** Trägt dieser Spieler nach dieser Runde die Käse-Krone? */
  hasCrown: boolean;
}

export interface RoundResult {
  round: number;
  breakdowns: ScoreBreakdown[];
  crownPlayerId: string | null;
}

/** Ein Angebot in der Draft-Phase. */
export interface DraftOffer {
  /** Die zur Wahl stehenden Würfel (jeweils eine neue Instanz). */
  options: DieDefinition[];
  /** Reihenfolge der Spieler-IDs, die noch ziehen müssen. */
  pickOrder: string[];
}

export interface GameOptions {
  /** Anzahl Runden (Standard 10). */
  rounds: number;
  /** Anzahl Würfel pro Draft-Angebot. */
  draftSize: number;
  /** Braun-Faces-Variante für Playtesting. */
  brownPreset: BrownPreset;
  /** Seed für den Zufallsgenerator (Reproduzierbarkeit / Tests). */
  seed: number;
}

export type BrownPreset = 'standard' | 'low' | 'wide';

export interface GameState {
  players: Player[];
  options: GameOptions;
  round: number;
  phase: Phase;
  /** Würfe der aktuellen Runde (nach der Roll-Phase gefüllt). */
  rolls: PlayerRoll[];
  /** Aktuelles Draft-Angebot (während der Draft-Phase). */
  draft: DraftOffer | null;
  /** Käse-Kronen-Halter der zuletzt gewerteten Runde. */
  crownPlayerId: string | null;
  /** Verlauf abgeschlossener Runden. */
  history: RoundResult[];
  /** Interner RNG-Zustand (für deterministische Fortsetzung). */
  rngState: number;
}
