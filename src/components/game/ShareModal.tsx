'use client';

import { useGameStore } from '@/store/gameStore';
import { useState } from 'react';

interface ShareModalProps {
  onClose: () => void;
  pnl: number;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
}

export default function ShareModal({ onClose, pnl, side, entryPrice, exitPrice }: ShareModalProps) {
  const { rank, xp, sessionStats } = useGameStore();
  const [copied, setCopied] = useState(false);

  const isWin = pnl >= 0;
  const pnlStr = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  const winRate = sessionStats.totalTrades > 0
    ? Math.round((sessionStats.wins / sessionStats.totalTrades) * 100)
    : 0;

  const shareText = `⚓ Battle Report — Broadside\n${isWin ? '🏆 VICTORY' : '⚠️ RETREAT'}: ${pnlStr}\nSide: ${side.toUpperCase()} BTC-PERP\nEntry: $${Math.round(entryPrice).toLocaleString()} → Exit: $${Math.round(exitPrice).toLocaleString()}\nRank: ${rank} | Win Rate: ${winRate}%\n\nPlay at app.pacifica.fi?referral=broadside ⚓`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(5,15,30,0.97)',
          border: `2px solid ${isWin ? '#ffd700' : '#ff8800'}`,
          borderRadius: '12px',
          padding: '28px 36px',
          minWidth: '320px',
          boxShadow: `0 0 60px ${isWin ? 'rgba(255,215,0,0.25)' : 'rgba(255,136,0,0.2)'}`,
          fontFamily: 'var(--font-share-tech-mono, monospace)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)', marginBottom: '6px' }}>
            BATTLE REPORT
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: isWin ? '#ffd700' : '#ff8800', textShadow: `0 0 20px ${isWin ? 'rgba(255,215,0,0.6)' : 'rgba(255,136,0,0.6)'}` }}>
            {pnlStr}
          </div>
          <div style={{ fontSize: '12px', color: isWin ? '#00ff88' : '#ff8800', letterSpacing: '0.15em' }}>
            {isWin ? 'VICTORY' : 'FLEET RETREATS'}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {[
            { label: 'SIDE', value: side.toUpperCase(), color: side === 'long' ? '#00ff88' : '#ff3333' },
            { label: 'RANK', value: rank.toUpperCase(), color: '#ffd700' },
            { label: 'ENTRY', value: `$${Math.round(entryPrice).toLocaleString()}`, color: '#aaa' },
            { label: 'EXIT', value: `$${Math.round(exitPrice).toLocaleString()}`, color: '#aaa' },
            { label: 'WIN RATE', value: `${winRate}%`, color: winRate >= 50 ? '#00ff88' : '#ff3333' },
            { label: 'TOTAL XP', value: `${xp}`, color: '#ffd700' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: '4px', padding: '8px 10px' }}
            >
              <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ fontSize: '12px', color, fontWeight: 'bold', marginTop: '2px' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Footer brand */}
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginBottom: '16px' }}>
          POWERED BY <span style={{ color: '#ffd700' }}>PACIFICA</span> · broadside.gg
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleCopy}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.08)', color: '#00d4ff', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.1em' }}
          >
            {copied ? 'COPIED' : 'COPY'}
          </button>
          <button
            onClick={handleTwitter}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(100,160,255,0.4)', background: 'rgba(100,160,255,0.1)', color: '#6499ff', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.1em' }}
          >
            SHARE
          </button>
          <button
            onClick={onClose}
            style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace' }}
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
}
