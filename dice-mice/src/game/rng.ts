// =====================================================================
// Deterministischer Zufallsgenerator (mulberry32).
//
// Bewusst seedbar, damit Spielzustände reproduzierbar sind: Tests werden
// deterministisch, und im Online-Modus können Server und Client denselben
// Seed teilen. Der RNG-Zustand wird als reine Zahl im GameState gehalten.
// =====================================================================

export interface Rng {
  /** Liefert eine Zahl in [0, 1). */
  next(): number;
  /** Würfelt eine ganze Zahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number;
  /** Aktueller interner Zustand (zum Speichern im GameState). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
    state() {
      return a >>> 0;
    },
  };
}
