import { memo, useEffect, useState } from 'react';
import type { CrewFace } from '../../types/game';

const FACE_ICON: Record<CrewFace, string> = {
  commander: '★',
  tactical: '✦',
  medical: '✚',
  science: '◈',
  engineering: '⚙',
  threat: '!',
};

interface DieProps {
  face: CrewFace;
  size?: 'normal' | 'small' | 'tiny';
  selected?: boolean;
  locked?: boolean;
  rolling?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Die = memo(function Die({
  face,
  size = 'normal',
  selected = false,
  locked = false,
  rolling = false,
  onClick,
  className = '',
}: DieProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!rolling) return;
    const tStart = setTimeout(() => setAnimating(true), 0);
    const tEnd = setTimeout(() => setAnimating(false), 650);
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [rolling]);

  const classes = [
    'die',
    `die--${face}`,
    size !== 'normal' ? `die--${size}` : '',
    selected ? 'die--selected' : '',
    locked ? 'die--locked' : '',
    animating ? 'die--rolling' : '',
    onClick && !locked ? 'die--pool' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={!locked ? onClick : undefined}
      title={face}
      role={onClick && !locked ? 'button' : undefined}
      aria-pressed={selected}
    >
      <span className="die__icon">{FACE_ICON[face]}</span>
      {size === 'normal' && <span className="die__label">{face}</span>}
    </div>
  );
});

export { FACE_ICON };
