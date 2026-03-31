'use client';

import { useGameStore, Timeframe } from '@/store/gameStore';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '60m'];

export default function TimeframeSelector() {
  const { timeframe, setTimeframe } = useGameStore();

  return (
    <div
      className="absolute flex items-center gap-1 font-mono"
      style={{
        bottom: '6px',
        left: '8px',
        zIndex: 20,
        background: 'rgba(5, 15, 30, 0.75)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: '4px',
        padding: '3px 6px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <span
        className="text-xs tracking-widest mr-1"
        style={{ color: 'rgba(0,212,255,0.4)', fontSize: '9px' }}
      >
        TF
      </span>
      {TIMEFRAMES.map((tf) => {
        const active = tf === timeframe;
        return (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className="text-xs tracking-wider transition-all"
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              fontSize: '11px',
              background: active ? 'rgba(0,212,255,0.18)' : 'transparent',
              border: `1px solid ${active ? 'rgba(0,212,255,0.7)' : 'transparent'}`,
              color: active ? '#00d4ff' : 'rgba(0,212,255,0.35)',
              cursor: 'pointer',
              fontWeight: active ? 'bold' : 'normal',
              textShadow: active ? '0 0 8px rgba(0,212,255,0.8)' : 'none',
            }}
          >
            {tf.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
