'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '@/lib/soundEngine';

function useRollingNumber(target: number, duration = 300) {
  const [display, setDisplay] = useState(target);
  const startRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = startRef.current;
    if (from === target) return;
    startTimeRef.current = null;

    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
        startRef.current = target;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

// Completed missions toast detector
function useMissionToast() {
  const missions = useGameStore(s => s.missions);
  const prevRef = useRef(missions);
  const [toast, setToast] = useState<{ title: string; reward: number } | null>(null);
  const [slidingOut, setSlidingOut] = useState(false);

  useEffect(() => {
    for (const mission of missions) {
      const wasCompleted = prevRef.current.find(m => m.id === mission.id)?.completed;
      if (mission.completed && !wasCompleted) {
        setToast({ title: mission.title, reward: mission.reward });
        setSlidingOut(false);
        soundEngine.playMissionComplete();
        const timer = setTimeout(() => {
          setSlidingOut(true);
          setTimeout(() => setToast(null), 500);
        }, 3000);
        prevRef.current = missions;
        return () => clearTimeout(timer);
      }
    }
    prevRef.current = missions;
  }, [missions]);

  return { toast, slidingOut };
}

export default function HUD() {
  const {
    position,
    currentPrice,
    gamePhase,
    combo,
    lightMode,
    toggleLightMode,
  } = useGameStore();


  // P&L rolling counter
  const pnlTarget = position?.unrealizedPnl ?? 0;
  const prevPnlRef = useRef(pnlTarget);
  const [pnlFlash, setPnlFlash] = useState<'up' | 'down' | 'none'>('none');
  const pnlFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayPnl = useRollingNumber(pnlTarget, 300);

  useEffect(() => {
    if (pnlTarget > prevPnlRef.current) {
      setPnlFlash('up');
    } else if (pnlTarget < prevPnlRef.current) {
      setPnlFlash('down');
    }
    prevPnlRef.current = pnlTarget;
    if (pnlFlashTimeoutRef.current) clearTimeout(pnlFlashTimeoutRef.current);
    pnlFlashTimeoutRef.current = setTimeout(() => setPnlFlash('none'), 400);
  }, [pnlTarget]);

  // Mission toast
  const { toast: missionToast, slidingOut } = useMissionToast();

  const marginHealth = position?.marginHealth ?? 100;
  const healthColor = marginHealth > 60 ? '#00ff88' : marginHealth > 30 ? '#ffd700' : '#ff3333';

  const phaseLabels: Record<string, string> = {
    idle: 'AWAITING ORDERS',
    aiming: 'ACQUIRING TARGET',
    firing: 'CANNONS FIRED!',
    active: 'BATTLE ACTIVE',
    retreating: 'RETREATING...',
    sunk: 'SHIP LOST!',
  };

  const phaseColors: Record<string, string> = {
    idle: '#00d4ff',
    aiming: '#ffd700',
    firing: '#ff8800',
    active: '#00ff88',
    retreating: '#ff8800',
    sunk: '#ff3333',
  };

  // Mock ticker values based on currentPrice
  const tickerItems = [
    `BTC $${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `24H ${currentPrice > 65000 ? '+' : '-'}${(Math.abs((currentPrice - 65000) / 65000) * 100).toFixed(2)}%`,
    'FUNDING 0.01%',
    'OPEN INT $2.1B',
    'VOL 24H $1.2B',
    `BTC $${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  ];
  const tickerText = tickerItems.join('  |  ');

  const pnlColor = pnlTarget >= 0 ? '#00ff88' : '#ff3333';
  const pnlFlashAnim = pnlFlash === 'up'
    ? 'pnl-flash-green 0.4s ease-in-out'
    : pnlFlash === 'down'
    ? 'pnl-flash-red 0.4s ease-in-out'
    : 'none';

  const formattedPnl = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
    maximumFractionDigits: 2,
  }).format(displayPnl);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

      {/* Day/Night toggle */}
      <button
        onClick={toggleLightMode}
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          top: '26px',
          right: '12px',
          zIndex: 30,
          background: lightMode ? 'rgba(255,255,255,0.85)' : 'rgba(5,15,30,0.85)',
          border: lightMode ? '1px solid rgba(0,100,200,0.4)' : '1px solid rgba(0,212,255,0.4)',
          borderRadius: '6px',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: lightMode ? '#1a2a3a' : '#00d4ff',
          lineHeight: 1,
        }}
        title={lightMode ? 'Switch to Night' : 'Switch to Day'}
      >
        {lightMode ? '🌙' : '☀️'}
      </button>

      {/* CRT scanline overlay */}
      <div className="scanline-overlay" />

      {/* Price ticker tape at very top */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none"
        style={{
          height: '18px',
          background: 'rgba(5,15,30,0.9)',
          borderBottom: '1px solid rgba(0,212,255,0.2)',
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            animation: 'marquee 22s linear infinite',
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#00d4ff',
            lineHeight: '18px',
            paddingLeft: '8px',
          }}
        >
          {tickerText}  |  {tickerText}
        </div>
      </div>

      {/* Mission complete toast */}
      {missionToast && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            animation: slidingOut
              ? 'mission-slide-out 0.4s ease-in forwards'
              : 'mission-slide-in 0.3s ease-out forwards',
            background: 'rgba(10,22,40,0.97)',
            border: '2px solid #ffd700',
            borderRadius: '4px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 20px rgba(255,215,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#00ff88', fontSize: '14px' }}>✓</span>
          <span style={{ color: '#ffd700', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            MISSION COMPLETE: {missionToast.title}
          </span>
          <span
            style={{
              color: '#00ff88',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              animation: 'xp-float 1s ease-out forwards',
            }}
          >
            +{missionToast.reward} XP
          </span>
        </div>
      )}

      {/* Top-left: Hull integrity */}
      <div className="absolute left-3 pointer-events-none" style={{ top: '24px' }}>
        <div
          className="px-2 py-1 rounded text-xs panel-corners glass-panel"
          style={{ fontFamily: 'var(--font-share-tech-mono, monospace)' }}
        >
          <div className="text-xs mb-1 font-orbitron" style={{ color: '#00d4ff', letterSpacing: '0.1em', fontFamily: 'var(--font-orbitron, monospace)' }}>
            HULL INTEGRITY
          </div>
          <div className="flex items-center gap-2">
            <div
              className="relative h-3 rounded-sm overflow-hidden"
              style={{
                width: '100px',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(0,212,255,0.3)',
              }}
            >
              <div
                className="absolute left-0 top-0 h-full transition-all duration-500"
                style={{
                  width: `${marginHealth}%`,
                  background: `linear-gradient(90deg, ${healthColor}99, ${healthColor})`,
                  boxShadow: `0 0 8px ${healthColor}`,
                }}
              />
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    left: `${(i + 1) * 10}%`,
                    background: 'rgba(0,0,0,0.4)',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-bold" style={{ color: healthColor }}>
              {marginHealth}%
            </span>
          </div>

          {position && (
            <div className="mt-1 text-xs" style={{ color: '#888' }}>
              LIQ: <span style={{ color: '#ff8800' }}>
                ${position.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top-center: Phase indicator + Combo badge */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '24px' }}>
        <div className="flex flex-col items-center gap-1">
          <div
            className="px-4 py-1 rounded font-bold tracking-widest glass-panel"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-orbitron, monospace)',
              border: `1px solid ${phaseColors[gamePhase] || '#00d4ff'}40`,
              color: phaseColors[gamePhase] || '#00d4ff',
              textShadow: `0 0 12px ${phaseColors[gamePhase] || '#00d4ff'}`,
            }}
          >
            {phaseLabels[gamePhase] || 'AWAITING ORDERS'}
          </div>

          {/* Combo badge */}
          {combo >= 2 && (
            <div
              className="px-3 py-0.5 rounded-full text-xs font-bold font-mono"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid #ffd700',
                color: '#ffd700',
                animation: 'combo-pulse 1s ease-in-out infinite',
                letterSpacing: '0.05em',
              }}
            >
              CHAIN x{combo}
            </div>
          )}
        </div>
      </div>

      {/* Left-side: Position info with rolling P&L */}
      {position && (
        <div className="absolute left-3" style={{ top: '100px' }}>
          <div
            className="px-2 py-2 rounded text-xs panel-corners glass-panel"
            style={{
              fontFamily: 'var(--font-share-tech-mono, monospace)',
              minWidth: '140px',
            }}
          >
            <div className="text-xs mb-1 font-orbitron" style={{ color: '#00d4ff', letterSpacing: '0.1em', fontFamily: 'var(--font-orbitron, monospace)' }}>
              ACTIVE POSITION
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between gap-3">
                <span style={{ color: '#888' }}>SIDE</span>
                <span
                  style={{ color: position.side === 'long' ? '#00ff88' : '#ff3333' }}
                  className="font-bold"
                >
                  {position.side === 'long' ? '▲ LONG' : '▼ SHORT'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span style={{ color: '#888' }}>LEV</span>
                <span style={{ color: '#ffd700' }}>{position.leverage}x</span>
              </div>
              <div className="flex justify-between gap-3">
                <span style={{ color: '#888' }}>ENTRY</span>
                <span style={{ color: '#aaa' }}>
                  ${position.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span style={{ color: '#888' }}>SIZE</span>
                <span style={{ color: '#aaa' }}>${position.size}</span>
              </div>
              <div
                className="flex justify-between gap-3 border-t mt-1 pt-1"
                style={{ borderColor: 'rgba(0,212,255,0.2)' }}
              >
                <span style={{ color: '#888' }}>PnL</span>
                <span
                  className="font-bold"
                  style={{
                    color: pnlColor,
                    animation: pnlFlashAnim,
                  }}
                >
                  {formattedPnl}
                  {gamePhase === 'active' && (
                    <span
                      style={{
                        marginLeft: '2px',
                        animation: 'blink-cursor 1s step-end infinite',
                        color: pnlColor,
                      }}
                    >
                      |
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liquidation warning */}
      {marginHealth < 25 && marginHealth > 0 && gamePhase === 'active' && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ animation: 'pulse 0.5s ease-in-out infinite' }}
        >
          <div
            className="px-6 py-3 rounded font-mono font-bold text-lg tracking-widest"
            style={{
              background: 'rgba(255,0,0,0.15)',
              border: '2px solid #ff3333',
              color: '#ff3333',
              textShadow: '0 0 20px #ff3333',
            }}
          >
            ⚠ CRITICAL HULL DAMAGE ⚠
          </div>
        </div>
      )}

      {/* Sunk overlay */}
      {gamePhase === 'sunk' && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="text-center font-mono">
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: '#ff3333', textShadow: '0 0 30px #ff3333' }}
            >
              SHIP SUNK
            </div>
            <div className="text-lg" style={{ color: '#ff8800' }}>
              POSITION LIQUIDATED
            </div>
            <div className="text-sm mt-2" style={{ color: '#888' }}>
              The Admiral goes down with the fleet...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
