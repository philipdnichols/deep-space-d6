import { memo, useEffect, useState } from 'react';
import type { ThreatSymbol } from '../../types/game';

const SYMBOL_ICON: Record<ThreatSymbol, string> = {
  skull: '☠',
  lightning: '⚡',
  alien: '👾',
  warning: '⚠',
  hazard: '☢',
  nova: '✺',
};

interface ThreatDieProps {
  face: ThreatSymbol | null;
  rolling?: boolean;
}

export const ThreatDie = memo(function ThreatDie({ face, rolling = false }: ThreatDieProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!rolling) return;
    const tStart = setTimeout(() => setAnimating(true), 0);
    const tEnd = setTimeout(() => setAnimating(false), 850);
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [rolling]);

  return (
    <div className="threat-die-area">
      <div className={`threat-die${animating ? ' threat-die--rolling' : ''}`}>
        <span className="threat-die__icon">{face ? SYMBOL_ICON[face] : '?'}</span>
        {face && <span className="threat-die__label">{face}</span>}
      </div>
      <span
        style={{
          fontSize: '0.6rem',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Threat Die
      </span>
    </div>
  );
});

export { SYMBOL_ICON };
