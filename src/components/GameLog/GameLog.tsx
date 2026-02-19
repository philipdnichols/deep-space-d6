import { memo, useEffect, useRef } from 'react';

interface GameLogProps {
  entries: ReadonlyArray<string>;
}

function entryClass(entry: string): string {
  const lower = entry.toLowerCase();
  if (lower.includes('damage') || lower.includes('hull') || lower.includes('destroyed')) {
    return 'game-log__entry game-log__entry--damage';
  }
  if (
    lower.includes('recover') ||
    lower.includes('repaired') ||
    lower.includes('shield') ||
    lower.includes('medical')
  ) {
    return 'game-log__entry game-log__entry--heal';
  }
  if (lower.includes('threat') || lower.includes('activates')) {
    return 'game-log__entry game-log__entry--threat';
  }
  return 'game-log__entry';
}

export const GameLog = memo(function GameLog({ entries }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="game-log">
      {entries.map((entry, i) => (
        <div key={i} className={entryClass(entry)}>
          {entry}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
});
