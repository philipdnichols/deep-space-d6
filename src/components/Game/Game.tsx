import { memo, useCallback, useState } from 'react';
import type { Dispatch } from 'react';
import type { Difficulty, GameState, StationId } from '../../types/game';
import type { GameAction } from '../../state/actions';
import { Header } from '../Header/Header';
import { Station } from '../Station/Station';
import { ThreatCardDisplay } from '../ThreatCardDisplay/ThreatCardDisplay';
import { Die } from '../Die/Die';
import { ThreatDie } from '../ThreatDie/ThreatDie';
import { GameLog } from '../GameLog/GameLog';
import { StartScreen } from '../StartScreen/StartScreen';
import { WinLoss } from '../WinLoss/WinLoss';
import { rollAllCrewDice, rollThreatDie } from '../../logic/dice';
import { isTimeWarpActive } from '../../logic/stations';
import { SYMBOL_ICON } from '../ThreatDie/ThreatDie';

const STATION_ORDER: StationId[] = [
  'commander',
  'tactical',
  'engineering',
  'medical',
  'science',
  'scanners',
  'infirmary',
];

interface GameProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const Game = memo(function Game({ state, dispatch }: GameProps) {
  const [diceRolling, setDiceRolling] = useState(false);
  const [threatRolling, setThreatRolling] = useState(false);

  const handleNewGame = useCallback(
    (difficulty: Difficulty) => {
      dispatch({ type: 'NEW_GAME', difficulty });
    },
    [dispatch],
  );

  const handleOpenNewGame = useCallback(() => {
    dispatch({ type: 'NEW_GAME', difficulty: state.difficulty });
  }, [dispatch, state.difficulty]);

  // Roll crew dice with animation
  const handleRollDice = useCallback(() => {
    dispatch({ type: 'START_ROLL' });
    setDiceRolling(true);
    const poolCount = state.crew.filter((d) => d.location === 'pool').length;
    const faces = rollAllCrewDice(poolCount);
    setTimeout(() => {
      setDiceRolling(false);
      dispatch({ type: 'ROLL_COMPLETE', faces });
    }, 700);
  }, [dispatch, state.crew]);

  // Roll threat die with animation
  const handleRollThreatDie = useCallback(() => {
    dispatch({ type: 'START_THREAT_ROLL' });
    setThreatRolling(true);
    const face = rollThreatDie();
    setTimeout(() => {
      setThreatRolling(false);
      dispatch({ type: 'THREAT_ROLL_COMPLETE', face });
    }, 900);
  }, [dispatch]);

  if (state.status === 'idle') {
    return (
      <div className="game-root">
        <Header state={state} dispatch={dispatch} onNewGame={() => {}} />
        <StartScreen onStart={handleNewGame} />
      </div>
    );
  }

  const poolDice = state.crew.filter((d) => d.location === 'pool');
  const timeWarpActive = isTimeWarpActive(state.activeThreats);

  const internalThreats = state.activeThreats.filter((t) => t.card.kind === 'internal');
  const externalThreats = state.activeThreats.filter(
    (t) => t.card.kind === 'external' || t.card.kind === 'boss-barrier',
  );

  return (
    <div className="game-root">
      <Header state={state} dispatch={dispatch} onNewGame={handleOpenNewGame} />

      <div className="game-board">
        {/* ── Left column: Stations ─────────────────────────────────────────── */}
        <div className="panel">
          <div className="panel__title">Ship Stations — RPTR</div>

          {/* Passive warnings */}
          {(state.nebulaActive || state.commsOfflineActive || timeWarpActive) && (
            <div className="passive-warnings">
              {state.nebulaActive && (
                <span className="passive-warning passive-warning--nebula">NEBULA</span>
              )}
              {state.commsOfflineActive && (
                <span className="passive-warning passive-warning--comms">COMMS OFFLINE</span>
              )}
              {timeWarpActive && (
                <span className="passive-warning passive-warning--timewarp">TIME WARP</span>
              )}
            </div>
          )}

          <div className="stations">
            {STATION_ORDER.map((id) => (
              <Station key={id} stationId={id} state={state} dispatch={dispatch} />
            ))}
          </div>
        </div>

        {/* ── Centre column ─────────────────────────────────────────────────── */}
        <div className="centre-column">
          {/* Threat areas */}
          {internalThreats.length > 0 && (
            <div className="threats-section">
              <div className="threats-section__heading">Internal Threats</div>
              <div className="threats-list">
                {internalThreats.map((t) => (
                  <ThreatCardDisplay key={t.id} threat={t} state={state} dispatch={dispatch} />
                ))}
              </div>
            </div>
          )}

          {externalThreats.length > 0 && (
            <div className="threats-section">
              <div className="threats-section__heading">External Threats</div>
              <div className="threats-list">
                {externalThreats.map((t) => (
                  <ThreatCardDisplay key={t.id} threat={t} state={state} dispatch={dispatch} />
                ))}
              </div>
            </div>
          )}

          {state.activeThreats.length === 0 && (
            <div
              style={{
                color: 'var(--text-dim)',
                fontSize: '0.8rem',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              No active threats. Stay alert.
            </div>
          )}

          {/* Drawn card display */}
          {state.drawnCard && state.phase === 'drawing' && (
            <div className="drawn-card-display">
              <div className="drawn-card-display__heading">Threat Card Drawn</div>
              <strong style={{ color: 'var(--text-bright)' }}>{state.drawnCard.name}</strong>
              <p
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {state.drawnCard.description}
              </p>
            </div>
          )}

          {/* Activation display */}
          {state.phase === 'activating' && state.threatDieFace && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-card)',
              }}
            >
              <ThreatDie face={state.threatDieFace} rolling={threatRolling} />
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 4,
                  }}
                >
                  Threat Die Result
                </div>
                <div style={{ fontSize: '1rem', color: 'var(--text-bright)' }}>
                  {SYMBOL_ICON[state.threatDieFace]} {state.threatDieFace}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: Log + Deck ──────────────────────────────────────── */}
        <div className="panel">
          <div className="panel__title">Mission Log</div>

          {/* Deck / discard counters */}
          <div style={{ display: 'flex', gap: 16, padding: '4px 0' }}>
            <div className="deck-counter">
              <span className="deck-counter__count">{state.deck.length}</span>
              <span className="deck-counter__label">In Deck</span>
            </div>
            <div className="deck-counter">
              <span className="deck-counter__count" style={{ color: 'var(--hull-low)' }}>
                {state.discard.length}
              </span>
              <span className="deck-counter__label">Discarded</span>
            </div>
          </div>

          <GameLog entries={state.log} />
        </div>

        {/* ── Bottom row: Dice pool ─────────────────────────────────────────── */}
        <div className="panel dice-pool-panel">
          <div className="panel__title">
            Crew Dice — Pool: {poolDice.length} / Infirmary:{' '}
            {state.crew.filter((d) => d.location === 'infirmary').length} / Scanners:{' '}
            {state.crew.filter((d) => d.location === 'scanners').length}
          </div>
          <div className="dice-pool">
            <div className="dice-pool__dice">
              {poolDice.map((d) => (
                <Die
                  key={d.id}
                  face={d.face}
                  rolling={diceRolling}
                  selected={state.selectedDieId === d.id}
                  onClick={
                    state.phase === 'assigning'
                      ? () =>
                          dispatch({
                            type: 'SELECT_DIE',
                            dieId: state.selectedDieId === d.id ? null : d.id,
                          })
                      : undefined
                  }
                />
              ))}
            </div>

            {state.phase === 'assigning' && state.selectedDieId !== null && (
              <div style={{ fontSize: '0.7rem', color: 'var(--science)' }}>
                Die selected — click a station or threat to assign
              </div>
            )}

            {state.phase === 'activating' && !state.threatDieFace && (
              <ThreatDie face={null} rolling={threatRolling} />
            )}
          </div>
        </div>
      </div>

      {/* ── Action Bar ────────────────────────────────────────────────────────── */}
      <ActionBar
        state={state}
        dispatch={dispatch}
        onRollDice={handleRollDice}
        onRollThreatDie={handleRollThreatDie}
        diceRolling={diceRolling}
        threatRolling={threatRolling}
      />

      {/* ── Win / Loss overlay ────────────────────────────────────────────────── */}
      {(state.status === 'won' || state.status === 'lost') && (
        <WinLoss state={state} onNewGame={handleOpenNewGame} />
      )}
    </div>
  );
});

// ── Action Bar ────────────────────────────────────────────────────────────────

interface ActionBarProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onRollDice: () => void;
  onRollThreatDie: () => void;
  diceRolling: boolean;
  threatRolling: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  rolling: 'Phase 1 — Roll',
  assigning: 'Phase 3 — Assign',
  drawing: 'Phase 4 — Draw',
  activating: 'Phase 5 — Activate',
  gathering: 'Phase 6 — Gather',
};

const ActionBar = memo(function ActionBar({
  state,
  dispatch,
  onRollDice,
  onRollThreatDie,
  diceRolling,
  threatRolling,
}: ActionBarProps) {
  const poolCount = state.crew.filter((d) => d.location === 'pool').length;

  return (
    <div className="action-bar">
      <span className="action-bar__phase">{PHASE_LABELS[state.phase] ?? state.phase}</span>
      <div className="action-bar__buttons">
        {state.phase === 'rolling' && (
          <button className="primary-btn" onClick={onRollDice} disabled={diceRolling}>
            {diceRolling ? 'Rolling...' : `Roll Dice (${poolCount} available)`}
          </button>
        )}

        {state.phase === 'assigning' && (
          <button className="primary-btn" onClick={() => dispatch({ type: 'END_ASSIGN_PHASE' })}>
            End Assignment
          </button>
        )}

        {state.phase === 'drawing' && (
          <button className="primary-btn" onClick={() => dispatch({ type: 'ACKNOWLEDGE_DRAW' })}>
            Continue
          </button>
        )}

        {state.phase === 'activating' && !state.threatDieFace && (
          <button className="primary-btn" onClick={onRollThreatDie} disabled={threatRolling}>
            {threatRolling ? 'Rolling Threat Die...' : 'Roll Threat Die'}
          </button>
        )}

        {state.phase === 'activating' && state.threatDieFace && (
          <button
            className="primary-btn"
            onClick={() => dispatch({ type: 'ACKNOWLEDGE_ACTIVATE' })}
          >
            Continue
          </button>
        )}

        {state.phase === 'gathering' && (
          <button className="primary-btn" onClick={() => dispatch({ type: 'ACKNOWLEDGE_GATHER' })}>
            Gather Crew & Next Turn
          </button>
        )}
      </div>

      <span className="action-bar__instructions">
        {state.phase === 'rolling' && 'Roll your crew dice to begin the turn.'}
        {state.phase === 'assigning' &&
          'Select a die then click a station. Assign tactical dice then click "Fire!" to attack.'}
        {state.phase === 'drawing' &&
          (state.drawnCard
            ? `Drew: ${state.drawnCard.name}. ${state.drawnCard.kind === 'filler' ? 'Nothing happens.' : state.drawnCard.immediateOnReveal ? 'Immediate effect triggered!' : 'Added to active threats.'}`
            : 'Deck is empty!')}
        {state.phase === 'activating' &&
          (!state.threatDieFace
            ? 'Roll the threat die to activate matching threats.'
            : `Rolled ${state.threatDieFace} — threats with that symbol activated.`)}
        {state.phase === 'gathering' &&
          'Crew returns to duty. Locked crew stays in Infirmary/Scanners.'}
      </span>
    </div>
  );
});
