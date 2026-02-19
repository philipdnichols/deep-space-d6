import { memo, useState } from 'react';
import type { Dispatch } from 'react';
import type { ActiveThreat, CrewFace, GameState, StationId } from '../../types/game';
import type { GameAction } from '../../state/actions';
import { Die } from '../Die/Die';
import { canAssignToStation } from '../../logic/stations';
import { ALL_CREW_FACES } from '../../logic/dice';

const STATION_META: Record<StationId, { icon: string; name: string; hint: string }> = {
  commander: { icon: '★', name: 'Commander', hint: 'Re-roll all or change one die' },
  tactical: { icon: '✦', name: 'Tactical', hint: 'Fire at an external threat' },
  engineering: { icon: '⚙', name: 'Engineering', hint: '+1 hull per die (auto)' },
  medical: { icon: '✚', name: 'Medical', hint: 'Recover Infirmary or free Scanners' },
  science: { icon: '◈', name: 'Science', hint: 'Recharge shields or place stasis' },
  scanners: { icon: '!', name: 'Scanners', hint: 'Threat Detected dice lock here' },
  infirmary: { icon: '✦', name: 'Infirmary', hint: 'Incapacitated crew' },
};

interface StationProps {
  stationId: StationId;
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

// Modal states for stations that need choices
type CommanderStep = 'choose' | 'pick-die' | 'pick-face';
type ScienceStep = 'choose' | 'pick-threat';

export const Station = memo(function Station({ stationId, state, dispatch }: StationProps) {
  const meta = STATION_META[stationId];
  const diceHere = state.crew.filter((d) => d.location === stationId);

  // Local modal states
  const [cmdStep, setCmdStep] = useState<CommanderStep>('choose');
  const [cmdTargetDie, setCmdTargetDie] = useState<number | null>(null);
  const [showCmdModal, setShowCmdModal] = useState(false);
  const [showSciModal, setShowSciModal] = useState(false);
  const [sciStep, setSciStep] = useState<ScienceStep>('choose');
  const [showTactModal, setShowTactModal] = useState(false);

  const selectedDie =
    state.selectedDieId !== null
      ? (state.crew.find((d) => d.id === state.selectedDieId) ?? null)
      : null;

  const canDrop =
    state.phase === 'assigning' &&
    selectedDie !== null &&
    stationId !== 'infirmary' &&
    stationId !== 'scanners' &&
    canAssignToStation(selectedDie, stationId, state.commsOfflineActive);

  const handleStationClick = () => {
    if (canDrop && selectedDie) {
      dispatch({ type: 'ASSIGN_TO_STATION', dieId: selectedDie.id, stationId });
    }
  };

  // Tactical: fire button
  const hasTactical = state.tacticalDice.length > 0;
  const hasExternalThreats = state.activeThreats.some(
    (t) => (t.card.kind === 'external' || t.card.kind === 'boss-barrier') && !t.isDestroyed,
  );

  // Science: recharge available?
  const sciDiceCount = diceHere.length;
  const hasSciDice = sciDiceCount > 0;

  // Medical: available?
  const medDiceCount = diceHere.length;
  const hasMedDice = medDiceCount > 0;

  // Commander
  const cmdDiceCount = diceHere.length;
  const hasCmdDice = cmdDiceCount > 0;

  // Engineering: resolved automatically at end of assign
  const engDiceCount = diceHere.length;
  const hasEngDice = engDiceCount > 0;

  const isAssigning = state.phase === 'assigning';
  const commsDisabled = state.commsOfflineActive && stationId === 'commander';

  return (
    <>
      <div
        className={['station', `station--${stationId}`, canDrop ? 'station--can-drop' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={handleStationClick}
      >
        <div className="station__header">
          <span className="station__icon">{meta.icon}</span>
          <span className="station__name">{meta.name}</span>
        </div>

        {commsDisabled && <div className="station__disabled-note">COMMS OFFLINE</div>}

        <div className="station__dice">
          {diceHere.map((d) => (
            <Die key={d.id} face={d.face} size="small" />
          ))}
        </div>

        {/* Station actions */}
        {isAssigning && (
          <div className="station__actions">
            {stationId === 'commander' && hasCmdDice && !commsDisabled && (
              <button
                className="station-action-btn"
                disabled={state.usedStationActions.includes('USE_COMMANDER')}
                onClick={(e) => {
                  e.stopPropagation();
                  setCmdStep('choose');
                  setShowCmdModal(true);
                }}
              >
                {state.usedStationActions.includes('USE_COMMANDER')
                  ? 'Commander Used'
                  : 'Use Commander'}
              </button>
            )}

            {stationId === 'tactical' && hasTactical && hasExternalThreats && (
              <button
                className="station-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTactModal(true);
                }}
              >
                Fire! ({state.tacticalDice.length} dice → {1 + (state.tacticalDice.length - 1) * 2}{' '}
                dmg)
              </button>
            )}

            {stationId === 'medical' && hasMedDice && (
              <>
                <button
                  className="station-action-btn"
                  disabled={
                    state.usedStationActions.includes('USE_MEDICAL') ||
                    !state.crew.some((d) => d.location === 'infirmary')
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'USE_MEDICAL' });
                  }}
                >
                  Recover All
                </button>
                {state.crew.some((d) => d.location === 'scanners') && (
                  <button
                    className="station-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'USE_MEDICAL_SCANNERS' });
                    }}
                  >
                    Free Scanner
                  </button>
                )}
              </>
            )}

            {stationId === 'science' && hasSciDice && (
              <>
                <button
                  className="station-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'USE_SCIENCE_SHIELDS' });
                  }}
                  disabled={
                    state.nebulaActive ||
                    state.usedStationActions.includes('USE_SCIENCE') ||
                    state.shields >= state.maxShields
                  }
                  title={
                    state.nebulaActive
                      ? 'Nebula prevents shield recharge'
                      : state.usedStationActions.includes('USE_SCIENCE')
                        ? 'Science action already used this turn'
                        : state.shields >= state.maxShields
                          ? 'Shields already at maximum'
                          : undefined
                  }
                >
                  {state.nebulaActive ? 'Shields Blocked' : 'Recharge Shields'}
                </button>
                {state.activeThreats.length > 0 && (
                  <button
                    className="station-action-btn"
                    disabled={state.usedStationActions.includes('USE_SCIENCE')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSciStep('pick-threat');
                      setShowSciModal(true);
                    }}
                  >
                    Place Stasis
                  </button>
                )}
              </>
            )}

            {stationId === 'engineering' && hasEngDice && (
              <button
                className="station-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'USE_ENGINEERING' });
                }}
                disabled={state.hull >= state.maxHull}
              >
                Repair Hull
              </button>
            )}
          </div>
        )}

        {canDrop && (
          <div style={{ fontSize: '0.6rem', color: 'var(--science)', marginTop: 4 }}>
            Click to assign
          </div>
        )}
      </div>

      {/* Commander modal */}
      {showCmdModal && (
        <CommanderModal
          step={cmdStep}
          targetDieId={cmdTargetDie}
          crew={state.crew}
          onChooseReroll={() => {
            dispatch({ type: 'USE_COMMANDER_REROLL' });
            setShowCmdModal(false);
          }}
          onChooseChange={() => setCmdStep('pick-die')}
          onPickDie={(id) => {
            setCmdTargetDie(id);
            setCmdStep('pick-face');
          }}
          onPickFace={(face) => {
            if (cmdTargetDie !== null) {
              dispatch({ type: 'USE_COMMANDER_CHANGE', targetDieId: cmdTargetDie, newFace: face });
            }
            setShowCmdModal(false);
            setCmdTargetDie(null);
          }}
          onClose={() => setShowCmdModal(false)}
        />
      )}

      {/* Science stasis modal */}
      {showSciModal && sciStep === 'pick-threat' && (
        <div className="modal-overlay" onClick={() => setShowSciModal(false)}>
          <div className="modal science-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">Place Stasis On...</div>
            <div className="modal__options">
              {state.activeThreats.map((t) => (
                <button
                  key={t.id}
                  className="science-threat-option"
                  onClick={() => {
                    dispatch({ type: 'USE_SCIENCE_STASIS', targetThreatId: t.id });
                    setShowSciModal(false);
                  }}
                >
                  {t.card.name}
                </button>
              ))}
            </div>
            <button className="modal__cancel-btn" onClick={() => setShowSciModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tactical target modal */}
      {showTactModal && (
        <TacticalModal
          threats={state.activeThreats}
          diceCount={state.tacticalDice.length}
          onFire={(id) => {
            dispatch({ type: 'USE_TACTICAL', targetThreatId: id });
            setShowTactModal(false);
          }}
          onClose={() => setShowTactModal(false)}
        />
      )}
    </>
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

interface CommanderModalProps {
  step: CommanderStep;
  targetDieId: number | null;
  crew: GameState['crew'];
  onChooseReroll: () => void;
  onChooseChange: () => void;
  onPickDie: (id: number) => void;
  onPickFace: (face: CrewFace) => void;
  onClose: () => void;
}

const CommanderModal = memo(function CommanderModal({
  step,
  crew,
  onChooseReroll,
  onChooseChange,
  onPickDie,
  onPickFace,
  onClose,
}: CommanderModalProps) {
  const poolDice = crew.filter((d) => d.location === 'pool');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {step === 'choose' && (
          <>
            <div className="modal__title">Commander Action</div>
            <div className="modal__options">
              <button
                className="station-action-btn"
                onClick={onChooseReroll}
                style={{ width: '100%', padding: '10px' }}
              >
                Re-roll All Unassigned ({poolDice.length} dice)
              </button>
              <button
                className="station-action-btn"
                onClick={onChooseChange}
                style={{ width: '100%', padding: '10px' }}
              >
                Change One Die to Any Face
              </button>
            </div>
            <button className="modal__cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {step === 'pick-die' && (
          <>
            <div className="modal__title">Choose Die to Change</div>
            <div className="target-die-list">
              {crew
                .filter(
                  (d) =>
                    d.location === 'pool' ||
                    d.location === 'tactical' ||
                    d.location === 'commander',
                )
                .map((d) => (
                  <button key={d.id} className="target-die-btn" onClick={() => onPickDie(d.id)}>
                    <Die face={d.face} size="small" />
                    <span>{d.face}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                      ({d.location})
                    </span>
                  </button>
                ))}
            </div>
            <button className="modal__cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {step === 'pick-face' && (
          <>
            <div className="modal__title">Change To...</div>
            <div className="modal__face-grid">
              {ALL_CREW_FACES.map((face) => (
                <div key={face} className="modal__die-option" onClick={() => onPickFace(face)}>
                  <Die face={face} size="small" />
                  <span>{face}</span>
                </div>
              ))}
            </div>
            <button className="modal__cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
});

interface TacticalModalProps {
  threats: ReadonlyArray<ActiveThreat>;
  diceCount: number;
  onFire: (threatId: string) => void;
  onClose: () => void;
}

const TacticalModal = memo(function TacticalModal({
  threats,
  diceCount,
  onFire,
  onClose,
}: TacticalModalProps) {
  const damage = 1 + (diceCount - 1) * 2;
  const validTargets = threats.filter(
    (t) => (t.card.kind === 'external' || t.card.kind === 'boss-barrier') && !t.isDestroyed,
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__title">
          Fire Tactical — {diceCount} dice → {damage} damage
        </div>
        <div className="modal__options">
          {validTargets.map((t) => (
            <button key={t.id} className="tactical-threat-option" onClick={() => onFire(t.id)}>
              {t.card.name} ({t.health}/{t.card.maxHealth} HP)
            </button>
          ))}
          {validTargets.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              No valid targets (Orbital Cannon requires being the only external threat).
            </div>
          )}
        </div>
        <button className="modal__cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
});
