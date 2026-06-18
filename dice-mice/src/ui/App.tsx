// =====================================================================
// UI (Phase 2 + Solo-Modus aus Phase 3). Bindet die Engine an und stellt
// alle vier Phasen pro Runde dar. KI-Gegner (src/game/ai.ts) machen ihre
// Tausch- und Draft-Züge automatisch. Würfel sind CSS-Platzhalter.
// Die UI hält KEINE Spiellogik – sie ruft nur Engine-/KI-Aktionen auf.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
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
  describeDie,
} from '../game/engine';
import { aiTakeSwapTurn, aiTakeDraftTurn } from '../game/ai';
import { COLOR_LABELS } from '../game/dice';
import type { Difficulty, GameState } from '../game/types';
import { Die } from './Die';
import { Setup, type SetupConfig } from './Setup';

const PHASE_LABEL: Record<string, string> = {
  roll: '1 · Würfeln',
  pity: '2 · Mitleidswürfel',
  swap: '3 · Klar-Würfel tauschen',
  draft: '4 · Drafting',
  finished: 'Spiel beendet',
};

function buildGame(config: SetupConfig): GameState {
  const seeds = [
    { id: 'p1', name: 'Du' },
    ...Array.from({ length: config.aiCount }, (_, i) => ({
      id: `ai${i + 1}`,
      name: `KI ${i + 1} (${difficultyLabel(config.difficulty)})`,
      ai: config.difficulty,
    })),
  ];
  return createGame(seeds, { seed: Math.floor(Math.random() * 1e9) });
}

function difficultyLabel(d: Difficulty): string {
  return d === 'easy' ? 'leicht' : d === 'normal' ? 'normal' : 'schwer';
}

export function App() {
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [state, setState] = useState<GameState | null>(null);

  if (!config || !state) {
    return (
      <div className="app">
        <header className="app__header">
          <h1>🧀 Dice Mice</h1>
        </header>
        <Setup
          onStart={(c) => {
            setConfig(c);
            setState(buildGame(c));
          }}
        />
        <footer className="app__footer">
          <small>Farben: {Object.values(COLOR_LABELS).join(' · ')}</small>
        </footer>
      </div>
    );
  }

  return (
    <Game
      state={state}
      setState={setState}
      onRestart={() => setState(buildGame(config))}
      onNewGame={() => {
        setConfig(null);
        setState(null);
      }}
    />
  );
}

function Game({
  state,
  setState,
  onRestart,
  onNewGame,
}: {
  state: GameState;
  setState: (s: GameState) => void;
  onRestart: () => void;
  onNewGame: () => void;
}) {
  const aiOf = (id: string) => state.players.find((p) => p.id === id)?.ai;
  const swapsDoneForRound = useRef(-1);

  // KI-Automatik: in der swap-Phase tauschen die KIs einmal pro Runde,
  // in der draft-Phase ziehen sie, sobald sie an der Reihe sind.
  useEffect(() => {
    if (state.phase === 'swap' && swapsDoneForRound.current !== state.round) {
      swapsDoneForRound.current = state.round;
      let next = state;
      for (const p of state.players) {
        if (p.ai) next = aiTakeSwapTurn(next, p.id, p.ai);
      }
      if (next !== state) setState(next);
      return;
    }
    if (state.phase === 'draft') {
      const drafter = currentDrafter(state);
      const ai = drafter ? aiOf(drafter) : undefined;
      if (drafter && ai) {
        const t = setTimeout(() => setState(aiTakeDraftTurn(state, ai)), 450);
        return () => clearTimeout(t);
      }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const drafter = currentDrafter(state);
  const drafterIsHuman = drafter ? !aiOf(drafter) : false;
  const result = state.phase === 'finished' ? gameResult(state) : null;
  const playerName = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? id;

  const totals = useMemo(
    () => [...state.players].sort((a, b) => b.totalScore - a.totalScore),
    [state],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>🧀 Dice Mice</h1>
        <div className="app__round">
          Runde {Math.min(state.round, state.options.rounds)} /{' '}
          {state.options.rounds} · <strong>{PHASE_LABEL[state.phase]}</strong>
        </div>
      </header>

      <section className="scoreboard">
        {totals.map((p) => (
          <div key={p.id} className="scoreboard__row">
            <span>
              {state.crownPlayerId === p.id && '👑 '}
              {p.name}
            </span>
            <span className="scoreboard__pts">{p.totalScore}</span>
          </div>
        ))}
      </section>

      {state.phase === 'finished' && result ? (
        <section className="finished">
          <h2>🏆 {playerName(result.winnerId)} gewinnt!</h2>
          <ol className="finished__ranking">
            {result.ranking.map((r) => (
              <li key={r.playerId}>
                {playerName(r.playerId)} — {r.totalScore} Punkte
              </li>
            ))}
          </ol>
          <button className="btn" onClick={onRestart}>
            Nochmal (gleiche Aufstellung)
          </button>
          <button className="btn btn--ghost" onClick={onNewGame}>
            Neues Spiel einrichten
          </button>
        </section>
      ) : (
        <>
          {state.rolls.length > 0 && (
            <section className="rolls">
              {state.rolls.map((roll) => (
                <div key={roll.playerId} className="rolls__player">
                  <h3>
                    {playerName(roll.playerId)}
                    {!aiOf(roll.playerId) && ' 🐭'}
                  </h3>
                  <div className="rolls__dice">
                    {roll.dice.map((d) => {
                      const swappable =
                        state.phase === 'swap' &&
                        d.def.color === 'clear' &&
                        !aiOf(roll.playerId);
                      return (
                        <Die
                          key={d.def.id}
                          color={d.def.color}
                          value={d.value}
                          swappable={swappable}
                          onSwap={() =>
                            setState(swapClearDie(state, roll.playerId, d.def.id))
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {state.phase === 'draft' && state.draft && (
            <section className="draft">
              <h3>
                Draft –{' '}
                {drafter
                  ? `${playerName(drafter)}${drafterIsHuman ? ' wählt' : ' überlegt …'}`
                  : 'fertig'}
              </h3>
              <div className="draft__options">
                {state.draft.options.map((opt, i) => (
                  <button
                    key={opt.id}
                    className="draft__option"
                    disabled={!drafterIsHuman}
                    onClick={() => setState(draftPick(state, drafter!, i))}
                  >
                    {describeDie(opt)}
                  </button>
                ))}
              </div>
              {drafterIsHuman && (
                <button
                  className="btn btn--ghost"
                  onClick={() => setState(draftSkip(state, drafter!))}
                >
                  Überspringen
                </button>
              )}
            </section>
          )}

          <div className="actions">
            <PhaseButton state={state} setState={setState} />
          </div>
        </>
      )}

      <footer className="app__footer">
        <button className="btn btn--ghost" onClick={onNewGame}>
          Spiel abbrechen
        </button>
      </footer>
    </div>
  );
}

function PhaseButton({
  state,
  setState,
}: {
  state: GameState;
  setState: (s: GameState) => void;
}) {
  switch (state.phase) {
    case 'roll':
      return (
        <button className="btn" onClick={() => setState(rollPhase(state))}>
          Würfeln
        </button>
      );
    case 'pity':
      return (
        <button className="btn" onClick={() => setState(pityPhase(state))}>
          Mitleidswürfel verteilen
        </button>
      );
    case 'swap':
      return (
        <button className="btn" onClick={() => setState(endSwapPhase(state))}>
          Tausch beenden → Draft
        </button>
      );
    case 'draft':
      return currentDrafter(state) ? null : (
        <button className="btn" onClick={() => setState(endRound(state))}>
          Runde werten
        </button>
      );
    default:
      return null;
  }
}
