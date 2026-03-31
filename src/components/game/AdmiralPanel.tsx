'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '@/lib/soundEngine';

const RANK_MAX_XP: Record<string, number> = {
  'Recruit': 100,
  'Ensign': 300,
  'Lieutenant': 600,
  'Commander': 1000,
  'Captain': 2000,
  'Commodore': 4000,
  'Rear Admiral': 8000,
  'Vice Admiral': 15000,
  'Admiral': 30000,
  'Admiral of the Fleet': 99999,
};

const RANK_MIN_XP: Record<string, number> = {
  'Recruit': 0,
  'Ensign': 100,
  'Lieutenant': 300,
  'Commander': 600,
  'Captain': 1000,
  'Commodore': 2000,
  'Rear Admiral': 4000,
  'Vice Admiral': 8000,
  'Admiral': 15000,
  'Admiral of the Fleet': 30000,
};

const RANK_BADGES: Record<string, string> = {
  'Recruit': '○',
  'Ensign': '◇',
  'Lieutenant': '◆',
  'Commander': '★',
  'Captain': '⚓',
  'Commodore': '⚓⚓',
  'Rear Admiral': '⚓★',
  'Vice Admiral': '★★',
  'Admiral': '★★★',
  'Admiral of the Fleet': '★★★★',
};

interface MissionToastState {
  missionTitle: string;
  xpReward: number;
  visible: boolean;
  slidingOut: boolean;
}

export default function AdmiralPanel() {
  const { xp, rank, missions, missionProgress, sessionStats, combatLog, lightMode } = useGameStore();
  const [toast, setToast] = useState<MissionToastState | null>(null);
  const prevMissionsRef = useRef(missions);
  const prevXpRef = useRef(xp);
  const [xpDelta, setXpDelta] = useState<number | null>(null);
  const xpDeltaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect newly completed missions
  useEffect(() => {
    const prevMissions = prevMissionsRef.current;
    for (const mission of missions) {
      const wasCompleted = prevMissions.find(m => m.id === mission.id)?.completed;
      if (mission.completed && !wasCompleted) {
        // Show toast
        setToast({ missionTitle: mission.title, xpReward: mission.reward, visible: true, slidingOut: false });
        soundEngine.playMissionComplete();
        // Dismiss after 3s
        setTimeout(() => {
          setToast(prev => prev ? { ...prev, slidingOut: true } : null);
          setTimeout(() => setToast(null), 500);
        }, 3000);
      }
    }
    prevMissionsRef.current = missions;
  }, [missions]);

  // XP gain animation
  useEffect(() => {
    if (xp > prevXpRef.current) {
      const delta = xp - prevXpRef.current;
      setXpDelta(delta);
      if (xpDeltaTimeoutRef.current) clearTimeout(xpDeltaTimeoutRef.current);
      xpDeltaTimeoutRef.current = setTimeout(() => setXpDelta(null), 1200);
    }
    prevXpRef.current = xp;
  }, [xp]);

  const rankMinXp = RANK_MIN_XP[rank] ?? 0;
  const rankMaxXp = RANK_MAX_XP[rank] ?? 100;
  const xpInRank = xp - rankMinXp;
  const xpForNextRank = rankMaxXp - rankMinXp;
  const xpPct = Math.min(100, (xpInRank / xpForNextRank) * 100);

  const winRate = sessionStats.totalTrades > 0
    ? Math.round((sessionStats.wins / sessionStats.totalTrades) * 100)
    : 0;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto panel-corners"
      style={{
        background: lightMode ? 'rgba(230, 245, 255, 0.92)' : 'rgba(5, 15, 30, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderLeft: lightMode ? '1px solid rgba(0,100,200,0.25)' : '1px solid rgba(0,212,255,0.2)',
        boxShadow: lightMode ? '0 8px 32px rgba(0,80,160,0.15)' : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        width: '200px',
        flexShrink: 0,
        position: 'relative',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
      }}
    >
      {/* Mission complete toast */}
      {toast && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            animation: toast.slidingOut
              ? 'mission-slide-out 0.4s ease-in forwards'
              : 'mission-slide-in 0.3s ease-out forwards',
            background: 'rgba(10,22,40,0.97)',
            border: '1px solid #ffd700',
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: '#00ff88', fontSize: '12px' }}>✓</span>
          <span style={{ color: '#ffd700', fontSize: '10px', flex: 1 }}>
            MISSION: {toast.missionTitle}
          </span>
          <span style={{ color: '#00ff88', fontSize: '10px' }}>
            +{toast.xpReward} XP
          </span>
        </div>
      )}

      {/* Admiral Profile */}
      <div
        className="px-3 py-3"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.2)' }}
      >
        <div
          className="text-xs font-bold tracking-widest mb-2 text-center"
          style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}
        >
          ⚓ ADMIRAL PROFILE
        </div>

        {/* Rank badge */}
        <div className="text-center mb-2">
          <div
            className="text-2xl mb-1"
            style={{
              color: '#ffd700',
              textShadow: '0 0 12px rgba(255,215,0,0.6)',
              animation: xpDelta ? 'rank-up 0.6s ease-in-out' : 'none',
            }}
          >
            {RANK_BADGES[rank] || '○'}
          </div>
          <div
            className="text-xs font-bold tracking-widest"
            style={{ color: '#ffd700', fontFamily: 'var(--font-orbitron, monospace)' }}
          >
            {rank.toUpperCase()}
          </div>
        </div>

        {/* XP Bar */}
        <div className="relative">
          <div className="flex justify-between text-xs mb-1" style={{ color: '#555', fontSize: '10px' }}>
            <span>XP</span>
            <span style={{ color: '#aaa' }}>{xp} / {rankMaxXp}</span>
          </div>
          <div
            className="h-2 rounded-sm overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,0,0.2)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${xpPct}%`,
                background: 'linear-gradient(90deg, #b8860b, #ffd700)',
                boxShadow: '0 0 6px rgba(255,215,0,0.5)',
              }}
            />
          </div>

          {/* XP delta float */}
          {xpDelta !== null && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '-4px',
                color: '#00ff88',
                fontSize: '10px',
                fontWeight: 'bold',
                animation: 'xp-float 1.2s ease-out forwards',
                pointerEvents: 'none',
              }}
            >
              +{xpDelta} XP
            </div>
          )}
        </div>
      </div>

      {/* Active Missions */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.2)' }}
      >
        <div
          className="text-xs font-bold tracking-widest mb-2"
          style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}
        >
          ACTIVE MISSIONS
        </div>

        <div className="space-y-2">
          {missions.slice(0, 3).map((mission) => {
            const progress = missionProgress[mission.id] || 0;
            const pct = Math.min(100, (progress / mission.target) * 100);

            return (
              <div
                key={mission.id}
                className="rounded px-2 py-1.5"
                style={{
                  background: mission.completed
                    ? 'rgba(0,255,136,0.05)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${mission.completed ? 'rgba(0,255,136,0.3)' : 'rgba(0,212,255,0.1)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <span style={{ color: mission.completed ? '#00ff88' : '#555', fontSize: '10px' }}>
                      {mission.completed ? '✓' : '□'}
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: mission.completed ? '#00ff88' : '#ccc',
                        fontSize: '10px',
                        textDecoration: mission.completed ? 'line-through' : 'none',
                      }}
                    >
                      {mission.title}
                    </span>
                  </div>
                  <span style={{ color: '#ffd700', fontSize: '9px' }}>
                    {mission.reward} XP
                  </span>
                </div>

                <div style={{ color: '#555', fontSize: '9px', marginBottom: '3px' }}>
                  {mission.description}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-1">
                  <div
                    className="flex-1 h-1 rounded-sm overflow-hidden"
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.1)' }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        background: mission.completed
                          ? '#00ff88'
                          : 'linear-gradient(90deg, #00d4ff80, #00d4ff)',
                      }}
                    />
                  </div>
                  <span style={{ color: '#555', fontSize: '9px', whiteSpace: 'nowrap' }}>
                    {mission.type === 'profit'
                      ? `$${progress.toFixed(0)}/$${mission.target}`
                      : `${progress}/${mission.target}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Stats */}
      <div className="px-3 py-2 flex-1">
        <div
          className="text-xs font-bold tracking-widest mb-2"
          style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}
        >
          SESSION STATS
        </div>

        <div
          className="rounded p-2 space-y-1.5"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.15)' }}
        >
          {[
            { label: 'TRADES', value: `${sessionStats.totalTrades}`, color: '#aaa' },
            { label: 'WIN RATE', value: `${winRate}%`, color: winRate >= 50 ? '#00ff88' : '#ff3333' },
            {
              label: 'BEST PnL',
              value: `${sessionStats.bestPnl >= 0 ? '+' : ''}$${sessionStats.bestPnl.toFixed(2)}`,
              color: sessionStats.bestPnl >= 0 ? '#00ff88' : '#ff3333',
            },
            { label: 'TOTAL XP', value: `${xp}`, color: '#ffd700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between text-xs">
              <span style={{ color: '#555' }}>{label}</span>
              <span style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Combat Log */}
      <div
        className="px-3 py-2"
        style={{ borderTop: '1px solid rgba(0,212,255,0.2)' }}
      >
        <div
          className="text-xs font-bold tracking-widest mb-2"
          style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}
        >
          COMBAT LOG
        </div>
        <div className="space-y-1">
          {combatLog.slice(0, 5).map((entry, i) => {
            const colors: Record<string, string> = {
              attack: '#ff3333', defend: '#00ff88', damage: '#ff8800',
              info: '#4a7a9b', victory: '#ffd700', defeat: '#ff3333',
            };
            const icons: Record<string, string> = {
              attack: '⚔', defend: '🛡', damage: '💥',
              info: '◈', victory: '★', defeat: '✗',
            };
            return (
              <div
                key={entry.timestamp + i}
                className="flex items-start gap-1"
                style={{
                  color: colors[entry.type] || '#aaa',
                  opacity: 1 - i * 0.18,
                  fontSize: '9px',
                  fontFamily: 'var(--font-share-tech-mono, monospace)',
                  lineHeight: '1.3',
                }}
              >
                <span style={{ flexShrink: 0 }}>{icons[entry.type] || '›'}</span>
                <span style={{ wordBreak: 'break-word' }}>{entry.message}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Branding footer */}
      <div
        className="mt-auto text-center py-2 px-3"
        style={{ borderTop: '1px solid rgba(255,215,0,0.15)' }}
      >
        <div className="text-xs" style={{ color: '#ffd700', fontSize: '10px' }}>
          ⚓ POWERED BY
        </div>
        <div className="text-xs font-bold tracking-widest" style={{ color: '#ffd700' }}>
          PACIFICA DEX
        </div>
      </div>
    </div>
  );
}
