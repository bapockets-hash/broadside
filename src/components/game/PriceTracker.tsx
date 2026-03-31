'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo } from 'react';

export default function PriceTracker() {
  const { currentPrice, priceHistory, timeframe } = useGameStore();

  const stats = useMemo(() => {
    if (priceHistory.length < 2) return null;
    const open = priceHistory[0];
    const high = Math.max(...priceHistory);
    const low = Math.min(...priceHistory);
    const change = currentPrice - open;
    const changePct = (change / open) * 100;
    const isUp = change >= 0;
    return { open, high, low, change, changePct, isUp };
  }, [currentPrice, priceHistory]);

  if (!stats) return null;

  const { high, low, change, changePct, isUp } = stats;
  const priceColor = isUp ? '#00ff88' : '#ff4444';
  const arrow = isUp ? '▲' : '▼';

  return (
    <div
      className="absolute"
      style={{
        bottom: '6px',
        right: '8px',
        zIndex: 20,
        background: 'rgba(5, 15, 30, 0.75)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: '4px',
        padding: '6px 10px',
        backdropFilter: 'blur(4px)',
        minWidth: '140px',
      }}
    >
      {/* Timeframe label */}
      <div style={{
        fontSize: '9px',
        color: 'rgba(0,212,255,0.4)',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
        letterSpacing: '0.15em',
        marginBottom: '2px',
      }}>
        BTC · {timeframe.toUpperCase()}
      </div>

      {/* Current price */}
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        color: priceColor,
        fontFamily: 'var(--font-share-tech-mono, monospace)',
        lineHeight: 1,
        textShadow: `0 0 12px ${priceColor}88`,
        letterSpacing: '0.02em',
      }}>
        ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>

      {/* Change */}
      <div style={{
        fontSize: '11px',
        color: priceColor,
        fontFamily: 'var(--font-share-tech-mono, monospace)',
        marginTop: '2px',
      }}>
        {arrow} {change >= 0 ? '+' : ''}{change.toFixed(0)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', margin: '5px 0' }} />

      {/* H/L */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '10px',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
      }}>
        <div>
          <span style={{ color: 'rgba(0,212,255,0.4)', fontSize: '8px', display: 'block', letterSpacing: '0.1em' }}>HIGH</span>
          <span style={{ color: '#00ff88' }}>${high.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'rgba(0,212,255,0.4)', fontSize: '8px', display: 'block', letterSpacing: '0.1em' }}>LOW</span>
          <span style={{ color: '#ff4444' }}>${low.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}
