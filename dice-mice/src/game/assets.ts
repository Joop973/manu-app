// =====================================================================
// Asset-Slots (Phase 5 vorbereitet).
//
// Hier werden NUR die Dateinamen/Slots für echte Audio- und Grafik-Assets
// definiert. Die Dateien selbst werden separat beschafft und unter
// public/audio bzw. public/characters abgelegt. Fehlt eine Datei, bleibt
// der zugehörige Hook stumm bzw. die UI zeigt einen CSS-Platzhalter.
// =====================================================================

export type SoundEvent =
  | 'diceRoll'
  | 'crownChange'
  | 'scoreTick'
  | 'draftPick'
  | 'roundChange'
  | 'victory'
  | 'warn';

/** Zuordnung Sound-Event -> Dateiname unter public/audio. */
export const SOUND_FILES: Record<SoundEvent, string> = {
  diceRoll: 'audio/dice-roll.mp3',
  crownChange: 'audio/crown-change.mp3',
  scoreTick: 'audio/score-tick.mp3',
  draftPick: 'audio/draft-pick.mp3',
  roundChange: 'audio/round-change.mp3',
  victory: 'audio/victory.mp3',
  warn: 'audio/warn.mp3',
};

/** Avatar-Dateiname für einen Spieler-Index (Slot für echte Maus-Grafik). */
export function characterSlot(index: number): string {
  return `characters/mouse-${index + 1}.png`;
}
