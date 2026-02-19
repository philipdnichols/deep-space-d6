import { memo } from 'react';
import type { Dispatch } from 'react';
import type { ActiveThreat, GameState } from '../../types/game';
import type { GameAction } from '../../state/actions';
import { Die } from '../Die/Die';
import { canTargetThreat } from '../../logic/threats';
import { canAssignToThreat } from '../../logic/stations';
import { SYMBOL_ICON } from '../ThreatDie/ThreatDie';

interface ThreatCardDisplayProps {
  threat: ActiveThreat;
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const ThreatCardDisplay = memo(function ThreatCardDisplay({
  threat,
  state,
  dispatch,
}: ThreatCardDisplayProps) {
  const { card } = threat;

  const selectedDie =
    state.selectedDieId !== null
      ? (state.crew.find((d) => d.id === state.selectedDieId) ?? null)
      : null;

  const canTarget =
    state.phase === 'assigning' &&
    state.tacticalDice.length > 0 &&
    canTargetThreat(threat, state.activeThreats);

  const canAssign =
    state.phase === 'assigning' &&
    selectedDie !== null &&
    canAssignToThreat(selectedDie, threat, state);

  const handleClick = () => {
    if (canAssign && selectedDie) {
      dispatch({ type: 'ASSIGN_TO_THREAT', dieId: selectedDie.id, threatId: threat.id });
    }
  };

  const kindClass =
    card.kind === 'internal'
      ? 'threat-card--internal'
      : card.kind === 'boss-barrier'
        ? 'threat-card--boss-barrier'
        : 'threat-card--external';

  // Crew dice on this threat's away mission
  const awayDice = state.crew.filter((d) => d.location === `threat-${threat.id}`);

  return (
    <div
      className={[
        'threat-card',
        kindClass,
        canTarget ? 'threat-card--can-target' : '',
        canAssign ? 'threat-card--can-assign' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
    >
      <div className="threat-card__header">
        <span className="threat-card__name">{card.name}</span>
        <span className={`threat-card__symbol threat-card__symbol--${card.activation}`}>
          {SYMBOL_ICON[card.activation]} {card.activation}
        </span>
      </div>

      {/* Health pips for external threats */}
      {card.maxHealth > 0 && (
        <div className="threat-card__health">
          <div className="threat-card__health-pips">
            {Array.from({ length: card.maxHealth }, (_, i) => (
              <div
                key={i}
                className={`threat-card__pip${i >= threat.health ? ' threat-card__pip--empty' : ''}`}
              />
            ))}
          </div>
          <span>
            {threat.health}/{card.maxHealth}
          </span>
          {threat.isDestroyed && card.isBarrier && (
            <span style={{ color: 'var(--medical)', marginLeft: 4 }}>[DESTROYED]</span>
          )}
        </div>
      )}

      <div className="threat-card__desc">{card.description}</div>

      {/* Resolution requirement */}
      {card.resolution && (
        <div className="threat-card__resolution">
          Resolve: {card.resolution.count}× {card.resolution.face} (
          {awayDice.filter((d) => d.face === card.resolution!.face).length}/{card.resolution.count})
        </div>
      )}

      {/* Away mission dice */}
      {awayDice.length > 0 && (
        <div className="threat-card__away-mission">
          {awayDice.map((d) => (
            <Die key={d.id} face={d.face} size="tiny" />
          ))}
        </div>
      )}

      {/* Stasis tokens */}
      {threat.stasisTokens > 0 && (
        <div className="threat-card__stasis">
          ◈ {threat.stasisTokens} stasis {threat.stasisTokens === 1 ? 'token' : 'tokens'}
        </div>
      )}

      {/* Target hint */}
      {canTarget && (
        <div style={{ fontSize: '0.65rem', color: 'var(--tactical)', marginTop: 4 }}>
          Click to fire tactical ({state.tacticalDice.length} dice →{' '}
          {1 + (state.tacticalDice.length - 1) * 2} dmg)
        </div>
      )}

      {canAssign && (
        <div style={{ fontSize: '0.65rem', color: 'var(--engineering)', marginTop: 4 }}>
          Click to assign to away mission
        </div>
      )}
    </div>
  );
});
