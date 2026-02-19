import { memo } from 'react';
import type { Dispatch } from 'react';
import type { Difficulty, GameState } from '../../types/game';
import type { GameAction } from '../../state/actions';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function hullClass(hull: number, maxHull: number): string {
  const pct = hull / maxHull;
  if (pct > 0.6) return 'stat-bar__fill--hull-high';
  if (pct > 0.3) return 'stat-bar__fill--hull-mid';
  return 'stat-bar__fill--hull-low';
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

interface HeaderProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  onNewGame: () => void;
}

export const Header = memo(function Header({ state, onNewGame }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__title">Deep Space D-6</div>

      {state.status === 'playing' && (
        <div className="header__stats">
          {/* Hull bar */}
          <div className="stat-bar">
            <span className="stat-bar__label">Hull</span>
            <div className="stat-bar__track">
              <div
                className={`stat-bar__fill ${hullClass(state.hull, state.maxHull)}`}
                style={{ width: `${(state.hull / state.maxHull) * 100}%` }}
              />
            </div>
            <span className="stat-bar__value">
              {state.hull}/{state.maxHull}
            </span>
          </div>

          {/* Shield bar */}
          <div className="stat-bar">
            <span className="stat-bar__label">Shields</span>
            <div className="stat-bar__track">
              <div
                className="stat-bar__fill stat-bar__fill--shield"
                style={{ width: `${(state.shields / state.maxShields) * 100}%` }}
              />
            </div>
            <span className="stat-bar__value">
              {state.shields}/{state.maxShields}
            </span>
          </div>

          <span className="header__turn">Turn {state.turnNumber}</span>
          <span className="header__timer">{formatTime(state.elapsedSeconds)}</span>
          <span className="header__turn" style={{ color: 'var(--text-dim)' }}>
            [{DIFFICULTY_LABELS[state.difficulty]}]
          </span>
        </div>
      )}

      <button className="header__new-game" onClick={onNewGame}>
        New Game
      </button>
    </header>
  );
});
