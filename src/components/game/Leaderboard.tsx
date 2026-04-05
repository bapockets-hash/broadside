'use client';

import { useGameStore } from '@/store/gameStore';
import { useClosePosition } from '@/hooks/useGameActions';
import type { Position } from '@/store/gameStore';

interface Admiral {
  rank: number;
  address: string;
  shipsSunk: number;
  fleetValue: number;
  isCurrentPlayer?: boolean;
}

const mockAdmirals: Admiral[] = [
  { rank: 1, address: '0x7f3a...9b2c', shipsSunk: 47, fleetValue: 128450 },
  { rank: 2, address: '0x2d8e...4f1a', shipsSunk: 38, fleetValue: 94320 },
  { rank: 3, address: '0xac91...7e33', shipsSunk: 31, fleetValue: 67800, isCurrentPlayer: true },
];

function PositionCloseButton({ pos, lightMode }: { pos: Position; lightMode: boolean }) {
  const close = useClosePosition(pos);
  return (
    <button
      onClick={close}
      style={{
        background: 'none',
        border: `1px solid rgba(255,60,60,0.3)`,
        color: '#cc4444',
        fontSize: '9px',
        padding: '1px 5px',
        borderRadius: '3px',
        cursor: 'pointer',
        fontFamily: 'monospace',
      }}
    >
      ✕
    </button>
  );
}

const rankStylesDark = ['#ffd700', '#c0c0c0', '#cd7f32', '#aaa', '#888'];
const rankStylesLight = ['#8a6200', '#607080', '#7a4a10', '#556677', '#445566'];
const rankLabels = ['ADMIRAL', 'COMMODORE', 'CAPTAIN', 'COMMANDER', 'LT. CMDR'];

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Leaderboard() {
  const admirals = mockAdmirals;
  const lightMode = useGameStore(s => s.lightMode);
  const positions = useGameStore(s => s.positions);
  const selectedSymbol = useGameStore(s => s.selectedSymbol);
  const setSelectedSymbol = useGameStore(s => s.setSelectedSymbol);
  const rankStyles = lightMode ? rankStylesLight : rankStylesDark;

  return (
    <div
      className="flex flex-col h-full panel-corners"
      style={{
        background: lightMode ? 'rgba(230, 245, 255, 0.92)' : 'rgba(5, 15, 30, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight: lightMode ? '1px solid rgba(0,100,200,0.25)' : '1px solid rgba(0,212,255,0.2)',
        boxShadow: lightMode ? '0 8px 32px rgba(0,80,160,0.15)' : 'none',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
      }}
    >
      {/* Open Positions */}
      <div
        className="flex-1 flex flex-col px-3 py-2 overflow-y-auto"
        style={{ borderBottom: lightMode ? '1px solid rgba(0,100,200,0.2)' : '1px solid rgba(0,212,255,0.2)' }}
      >
        <div className="text-xs font-bold tracking-widest mb-1.5" style={{ color: lightMode ? '#0055aa' : '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
          POSITIONS
        </div>
        {positions.length === 0 ? (
          <div style={{ fontSize: '9px', color: lightMode ? '#778899' : '#445', letterSpacing: '0.05em' }}>
            NO OPEN POSITIONS
          </div>
        ) : (
          <div className="space-y-1">
            {positions.map(pos => {
              const pnlColor = pos.unrealizedPnl >= 0 ? (lightMode ? '#007744' : '#00ff88') : '#cc2222';
              const isSelected = pos.symbol === selectedSymbol;
              return (
                <div
                  key={pos.id}
                  onClick={() => setSelectedSymbol(pos.symbol)}
                  className="rounded px-2 py-1"
                  style={{
                    background: isSelected
                      ? (lightMode ? 'rgba(0,100,200,0.12)' : 'rgba(0,212,255,0.1)')
                      : (lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.3)'),
                    border: `1px solid ${isSelected
                      ? (lightMode ? 'rgba(0,100,200,0.5)' : 'rgba(0,212,255,0.4)')
                      : (lightMode ? 'rgba(0,100,200,0.2)' : 'rgba(0,212,255,0.12)')}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = lightMode ? 'rgba(0,100,200,0.07)' : 'rgba(0,212,255,0.07)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.3)';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span style={{ color: pos.side === 'long' ? (lightMode ? '#007744' : '#00ff88') : '#cc2222', fontSize: '10px', fontWeight: 'bold' }}>
                        {pos.side === 'long' ? '▲' : '▼'} {pos.symbol}
                      </span>
                      <span style={{ color: lightMode ? '#778899' : '#556', fontSize: '9px' }}>{pos.leverage}x</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span style={{ color: pnlColor, fontSize: '9px', fontWeight: 'bold' }}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                      </span>
                      <PositionCloseButton pos={pos} lightMode={lightMode} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span style={{ color: lightMode ? '#778899' : '#445', fontSize: '8px' }}>
                      @{pos.entryPrice < 1 ? pos.entryPrice.toFixed(4) : pos.entryPrice < 100 ? pos.entryPrice.toFixed(2) : pos.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    <span style={{ color: lightMode ? '#778899' : '#445', fontSize: '8px' }}>{pos.size} {pos.symbol}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rankings header */}
      <div
        className="px-3 py-2 text-center"
        style={{ borderBottom: lightMode ? '1px solid rgba(0,100,200,0.2)' : '1px solid rgba(0,212,255,0.2)' }}
      >
        <div
          className="text-xs font-bold tracking-widest"
          style={{ color: lightMode ? '#8a6200' : '#ffd700', textShadow: lightMode ? 'none' : '0 0 10px rgba(255,215,0,0.5)', fontFamily: 'var(--font-orbitron, monospace)' }}
        >
          ★ ADMIRAL RANKINGS ★
        </div>
        <div className="text-xs mt-0.5" style={{ color: lightMode ? '#5a6a7a' : '#555' }}>
          GLOBAL FLEET STANDINGS
        </div>
      </div>

      {/* Admirals list — top 3 */}
      <div className="px-2 space-y-1.5 py-2">
        {admirals.map((admiral) => (
          <div
            key={admiral.rank}
            className="rounded px-2 py-2 relative overflow-hidden"
            style={{
              background: admiral.isCurrentPlayer
                ? (lightMode ? 'rgba(0,100,200,0.1)' : 'rgba(0,212,255,0.12)')
                : (lightMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'),
              border: `1px solid ${admiral.isCurrentPlayer
                ? (lightMode ? 'rgba(0,100,200,0.4)' : 'rgba(0,212,255,0.5)')
                : (lightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)')}`,
            }}
          >
            {admiral.isCurrentPlayer && (
              <div
                className="absolute top-0 right-0 text-xs px-1"
                style={{
                  background: lightMode ? 'rgba(0,100,200,0.15)' : 'rgba(0,212,255,0.3)',
                  color: lightMode ? '#0066cc' : '#00d4ff',
                  fontSize: '9px',
                }}
              >
                YOU
              </div>
            )}

            {/* Rank + name row */}
            <div className="flex items-center gap-2 mb-1">
              <div
                className="text-sm font-bold w-5 text-center flex-shrink-0"
                style={{ color: rankStyles[admiral.rank - 1] || '#666' }}
              >
                {admiral.rank}
              </div>
              <div>
                <div className="text-xs font-bold" style={{ color: lightMode ? '#1a2a3a' : '#ccc', fontFamily: 'var(--font-share-tech-mono, monospace)' }}>
                  {truncateAddress(admiral.address)}
                </div>
                <div className="text-xs" style={{ color: rankStyles[admiral.rank - 1] || '#555', fontSize: '9px', fontFamily: 'var(--font-orbitron, monospace)' }}>
                  {rankLabels[admiral.rank - 1] || 'ENSIGN'}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs" style={{ fontSize: '10px' }}>
              <div>
                <span style={{ color: lightMode ? '#5a6a7a' : '#555' }}>SUNK: </span>
                <span style={{ color: '#ff8800' }}>{admiral.shipsSunk}</span>
              </div>
              <div>
                <span style={{ color: lightMode ? '#5a6a7a' : '#555' }}>VALUE: </span>
                <span style={{ color: '#00bb55' }}>
                  ${admiral.fleetValue.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            {/* Mini progress bar for fleet value */}
            <div
              className="mt-1 h-0.5 rounded overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${(admiral.fleetValue / 128450) * 100}%`,
                  background: rankStyles[admiral.rank - 1] || '#555',
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div
        className="px-3 py-2"
        style={{ borderTop: lightMode ? '1px solid rgba(0,100,200,0.15)' : '1px solid rgba(0,212,255,0.15)' }}
      >
        <div className="text-xs text-center" style={{ color: lightMode ? '#5a6a7a' : '#555', fontSize: '10px' }}>
          <div>ACTIVE ADMIRALS: 247</div>
          <div style={{ color: lightMode ? '#0066cc' : '#00d4ff', marginTop: '2px' }}>
            TOTAL VOLUME: $4.2M
          </div>
        </div>
      </div>
    </div>
  );
}
