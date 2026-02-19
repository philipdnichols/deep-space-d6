import { memo } from 'react';
import type { Difficulty, GameState } from '../../types/game';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface WinLossProps {
  state: GameState;
  onNewGame: () => void;
}

export const WinLoss = memo(function WinLoss({ state, onNewGame }: WinLossProps) {
  const won = state.status === 'won';

  return (
    <div className="win-loss-overlay">
      <div className={`win-loss-card win-loss-card--${won ? 'won' : 'lost'}`}>
        <div className="win-loss-card__icon">{won ? '★' : '☠'}</div>
        <div className="win-loss-card__title">{won ? 'Rescue Arrived' : 'Ship Lost'}</div>
        <div className="win-loss-card__subtitle">
          {won
            ? 'The RPTR held together long enough. Rescue forces secured the sector.'
            : state.lossReason === 'hull'
              ? 'Critical hull failure. The RPTR was destroyed in the engagement.'
              : 'All crew incapacitated. The ship drifts without a crew to operate it.'}
        </div>
        <div className="win-loss-card__stats">
          <span>Turns survived: {state.turnNumber}</span>
          <span>Time elapsed: {formatTime(state.elapsedSeconds)}</span>
          <span>
            Hull remaining: {state.hull}/{state.maxHull}
          </span>
          <span>Difficulty: {DIFFICULTY_LABELS[state.difficulty]}</span>
        </div>
        <button className="start-btn" onClick={onNewGame}>
          Play Again
        </button>
      </div>
    </div>
  );
});
