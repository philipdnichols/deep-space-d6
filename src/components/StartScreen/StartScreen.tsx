import { memo, useState } from 'react';
import type { Difficulty } from '../../types/game';

interface StartScreenProps {
  onStart: (difficulty: Difficulty) => void;
}

export const StartScreen = memo(function StartScreen({ onStart }: StartScreenProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <div className="start-screen">
      <h1 className="start-screen__title">Deep Space D-6</h1>
      <p className="start-screen__subtitle">
        Your RPTR-class starship answered a distress call in the Auborne system. It was a trap.
        Survive the onslaught until rescue arrives.
      </p>

      <div className="start-screen__difficulty">
        <label>Difficulty</label>
        <div className="difficulty-buttons">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              className={`difficulty-btn${difficulty === d ? ' difficulty-btn--active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d === 'easy' ? 'Easy' : d === 'normal' ? 'Normal' : 'Hard'}
            </button>
          ))}
        </div>
        <p
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-dim)',
            maxWidth: 280,
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          {difficulty === 'easy' && "10 Don't Panic cards — more breathing room."}
          {difficulty === 'normal' && "5 Don't Panic cards — standard challenge."}
          {difficulty === 'hard' && "No Don't Panic cards — relentless threat pressure."}
        </p>
      </div>

      <button className="start-btn" onClick={() => onStart(difficulty)}>
        Launch
      </button>
    </div>
  );
});
