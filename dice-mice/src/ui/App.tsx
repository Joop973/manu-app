// =====================================================================
// Pass-and-Play-UI (Phase 2, schlank). Bindet die Engine aus Phase 1 an
// und stellt alle vier Phasen pro Runde dar. Würfel sind CSS-Platzhalter.
// Die UI hält KEINE Spiellogik – sie ruft nur Engine-Aktionen auf.
// =====================================================================
import { useMemo, useState } from 'react';
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
import { COLOR_LABELS } from '../game/dice';
import type { GameState } from '../game/types';
import { Die } from './Die';

const PLAYERS = [
  { id: 'p1', name: 'Maus 1' },
  { id: 'p2', name: 'Maus 2' },
];

const PHASE_LABEL: Record<string, string> = {
  roll: '1 · Würfeln',
  pity: '2 · Mitleidswürfel',
  swap: '3 · Klar-Würfel tauschen',
  draft: '4 · Drafting',
  finished: 'Spiel beendet',
};

export function App() {
  const [state, setState] = useState<GameState>(() =>
    createGame(PLAYERS, { seed: Math.floor(Math.random() * 1e9) }),
  );

  const drafter = currentDrafter(state);
  const result = state.phase === 'finished' ? gameResult(state) : null;
  const playerName = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? id;

  const totals = useMemo(
    () =>
      [...state.players].sort((a, b) => b.totalScore - a.totalScore),
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
        <FinishedView state={state} result={result} onRestart={() => setState(createGame(PLAYERS, { seed: Math.floor(Math.random() * 1e9) }))} />
      ) : (
        <>
          {state.rolls.length > 0 && (
            <section className="rolls">
              {state.rolls.map((roll) => (
                <div key={roll.playerId} className="rolls__player">
                  <h3>{playerName(roll.playerId)}</h3>
                  <div className="rolls__dice">
                    {roll.dice.map((d) => (
                      <Die
                        key={d.def.id}
                        color={d.def.color}
                        value={d.value}
                        swappable={state.phase === 'swap' && d.def.color === 'clear'}
                        onSwap={() =>
                          setState(swapClearDie(state, roll.playerId, d.def.id))
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {state.phase === 'draft' && state.draft && (
            <section className="draft">
              <h3>
                Draft – {drafter ? `${playerName(drafter)} wählt` : 'fertig'}
              </h3>
              <div className="draft__options">
                {state.draft.options.map((opt, i) => (
                  <button
                    key={opt.id}
                    className="draft__option"
                    disabled={!drafter}
                    onClick={() => setState(draftPick(state, drafter!, i))}
                  >
                    {describeDie(opt)}
                  </button>
                ))}
              </div>
              {drafter && (
                <button className="btn btn--ghost" onClick={() => setState(draftSkip(state, drafter))}>
                  {playerName(drafter)} überspringt
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
        <small>
          Farben: {Object.values(COLOR_LABELS).join(' · ')}
        </small>
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

function FinishedView({
  state,
  result,
  onRestart,
}: {
  state: GameState;
  result: ReturnType<typeof gameResult>;
  onRestart: () => void;
}) {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  return (
    <section className="finished">
      <h2>🏆 {name(result.winnerId)} gewinnt!</h2>
      <ol className="finished__ranking">
        {result.ranking.map((r) => (
          <li key={r.playerId}>
            {name(r.playerId)} — {r.totalScore} Punkte
          </li>
        ))}
      </ol>
      <button className="btn" onClick={onRestart}>
        Neues Spiel
      </button>
    </section>
  );
}
