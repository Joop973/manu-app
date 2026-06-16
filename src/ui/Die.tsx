// CSS-Platzhalter-Würfel. In Phase 4 durch react-three-fiber-3D-Würfel
// ersetzbar – die Schnittstelle (Farbe + Wert) bleibt gleich.
import type { DieColor } from '../game/types';

const COLOR_HEX: Record<DieColor, string> = {
  yellow: '#f2c83b',
  green: '#5bbf6a',
  blue: '#4b8ef0',
  blueGlitter: '#6aa8ff',
  purple: '#9b6cdb',
  red: '#e15555',
  clear: '#dfe6ee',
  pink: '#f06ab0',
  orange: '#f0962a',
  sabotage: '#3a3a3a',
  brown: '#8a5a2b',
};

export function Die({
  color,
  value,
  swappable,
  onSwap,
}: {
  color: DieColor;
  value: number;
  swappable?: boolean;
  onSwap?: () => void;
}) {
  const dark = color === 'sabotage';
  return (
    <button
      className={`die ${swappable ? 'die--swappable' : ''}`}
      style={{
        background: COLOR_HEX[color],
        color: dark || color === 'clear' ? (dark ? '#fff' : '#333') : '#1a1a1a',
        borderColor: color === 'clear' ? '#b6c2cf' : 'rgba(0,0,0,0.25)',
      }}
      onClick={swappable ? onSwap : undefined}
      title={swappable ? 'Klar-Würfel tauschen' : undefined}
      disabled={!swappable}
    >
      {value}
      {color === 'blueGlitter' && <span className="die__sparkle">✦</span>}
    </button>
  );
}
