// Setup-Screen: Anzahl KI-Gegner und Schwierigkeit wählen (Solo-Modus).
// 0 KI-Gegner = Pass-and-Play für einen einzelnen Übungslauf.
import { useState } from 'react';
import type { Difficulty } from '../game/types';

export interface SetupConfig {
  aiCount: number;
  difficulty: Difficulty;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Leicht' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Schwer' },
];

export function Setup({ onStart }: { onStart: (c: SetupConfig) => void }) {
  const [aiCount, setAiCount] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <section className="setup">
      <h2>Solo-Spiel einrichten</h2>

      <label className="setup__field">
        <span>KI-Gegner</span>
        <div className="setup__choices">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`chip ${aiCount === n ? 'chip--on' : ''}`}
              onClick={() => setAiCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </label>

      <label className="setup__field">
        <span>Schwierigkeit</span>
        <div className="setup__choices">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              className={`chip ${difficulty === d.value ? 'chip--on' : ''}`}
              onClick={() => setDifficulty(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </label>

      <button className="btn" onClick={() => onStart({ aiCount, difficulty })}>
        Spiel starten
      </button>
    </section>
  );
}
