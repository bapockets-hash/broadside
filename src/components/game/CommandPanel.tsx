'use client';

import { useGameStore } from '@/store/gameStore';

interface CommandPanelProps {
  onFire: () => void;
  onRetreat: () => void;
}

export default function CommandPanel({ onFire, onRetreat }: CommandPanelProps) {
  const {
    selectedSide,
    leverage,
    tradeSize,
    position,
    isLoading,
    gamePhase,
    setSelectedSide,
    setLeverage,
    setTradeSize,
    lightMode,
  } = useGameStore();

  const canFire = selectedSide !== null && leverage >= 1 && tradeSize > 0 && !isLoading && gamePhase === 'idle';
  const canRetreat = position !== null && !isLoading && (gamePhase === 'active' || gamePhase === 'firing' || gamePhase === 'aiming');

  const leverageLevels = [1, 2, 3, 5, 7, 10];

  return (
    <div
      className="w-full flex items-stretch gap-0"
      style={{
        background: lightMode ? 'rgba(230, 245, 255, 0.92)' : 'rgba(5, 15, 30, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: lightMode ? '1px solid rgba(0,100,200,0.25)' : '1px solid rgba(0,212,255,0.3)',
        boxShadow: lightMode ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        minHeight: '120px',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
      }}
    >
      {/* Left: Target & Stance */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2"
        style={{
          width: '280px',
          borderRight: '1px solid rgba(0,212,255,0.15)',
          flexShrink: 0,
        }}
      >
        <div className="text-xs tracking-widest mb-1" style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
          TARGET &amp; STANCE
        </div>

        {/* Asset selector */}
        <div
          className="flex items-center gap-2 px-2 py-1 rounded text-xs"
          style={{
            background: 'rgba(0,212,255,0.05)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff',
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-xs"
            style={{ borderColor: '#00d4ff' }}
          >
            ◎
          </div>
          <span className="font-bold">BTC-PERP</span>
          <span className="ml-auto" style={{ color: '#555' }}>▼</span>
        </div>

        {/* Attack / Defend buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSide(selectedSide === 'short' ? null : 'short')}
            disabled={gamePhase === 'active' || gamePhase === 'sunk'}
            className="flex-1 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: selectedSide === 'short'
                ? 'rgba(255,51,51,0.3)'
                : 'rgba(255,51,51,0.1)',
              border: `1px solid ${selectedSide === 'short' ? '#ff3333' : 'rgba(255,51,51,0.3)'}`,
              color: '#ff3333',
              boxShadow: selectedSide === 'short' ? '0 0 15px rgba(255,51,51,0.4)' : 'none',
              cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
              opacity: gamePhase === 'active' ? 0.5 : 1,
            }}
          >
            ⚔ ATTACK
          </button>
          <button
            onClick={() => setSelectedSide(selectedSide === 'long' ? null : 'long')}
            disabled={gamePhase === 'active' || gamePhase === 'sunk'}
            className="flex-1 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: selectedSide === 'long'
                ? 'rgba(0,255,136,0.3)'
                : 'rgba(0,255,136,0.1)',
              border: `1px solid ${selectedSide === 'long' ? '#00ff88' : 'rgba(0,255,136,0.3)'}`,
              color: '#00ff88',
              boxShadow: selectedSide === 'long' ? '0 0 15px rgba(0,255,136,0.4)' : 'none',
              cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
              opacity: gamePhase === 'active' ? 0.5 : 1,
            }}
          >
            🛡 DEFEND
          </button>
        </div>

        <div className="text-xs text-center" style={{ color: '#555' }}>
          {selectedSide === 'short' ? 'SHORT — Profit if price falls' :
           selectedSide === 'long' ? 'LONG — Profit if price rises' :
           'Select your battle stance'}
        </div>
      </div>

      {/* Center: Power Level */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2 flex-1"
        style={{ borderRight: '1px solid rgba(0,212,255,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs tracking-widest" style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
            POWER LEVEL
          </div>
          <div
            className="text-xl font-bold"
            style={{
              color: leverage >= 7 ? '#ff3333' : leverage >= 4 ? '#ffd700' : '#00ff88',
              textShadow: '0 0 10px currentColor',
            }}
          >
            {leverage}x
          </div>
        </div>

        {/* Power bar nodes */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: 10 }, (_, i) => {
            const nodeLevel = i + 1;
            const isActive = nodeLevel <= leverage;
            const nodeColor = nodeLevel >= 8 ? '#ff3333' :
                             nodeLevel >= 5 ? '#ffd700' : '#00ff88';
            return (
              <button
                key={i}
                onClick={() => setLeverage(nodeLevel)}
                disabled={gamePhase === 'active' || gamePhase === 'sunk'}
                className="flex-1 rounded transition-all"
                style={{
                  height: '20px',
                  background: isActive ? nodeColor : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? nodeColor : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: isActive ? `0 0 6px ${nodeColor}60` : 'none',
                  cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
                }}
              />
            );
          })}
        </div>

        {/* Leverage presets */}
        <div className="flex gap-1">
          {leverageLevels.map(l => (
            <button
              key={l}
              onClick={() => setLeverage(l)}
              disabled={gamePhase === 'active' || gamePhase === 'sunk'}
              className="flex-1 py-0.5 rounded text-xs transition-all"
              style={{
                background: leverage === l ? 'rgba(0,212,255,0.2)' : 'rgba(0,212,255,0.05)',
                border: `1px solid ${leverage === l ? '#00d4ff' : 'rgba(0,212,255,0.15)'}`,
                color: leverage === l ? '#00d4ff' : '#555',
                cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
              }}
            >
              {l}x
            </button>
          ))}
        </div>

        <div className="flex justify-between text-xs" style={{ color: '#333' }}>
          <span>MINIMAL FORCE</span>
          <span>MAXIMUM FIREPOWER</span>
        </div>
      </div>

      {/* Right: Fleet Orders */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2"
        style={{ width: '240px', flexShrink: 0 }}
      >
        <div className="text-xs tracking-widest mb-1" style={{ color: '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
          FLEET ORDERS
        </div>

        {/* Trade size input */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#888' }}>SIZE $</span>
          <input
            type="number"
            value={tradeSize}
            onChange={(e) => setTradeSize(Math.max(10, Number(e.target.value)))}
            disabled={gamePhase === 'active' || gamePhase === 'sunk'}
            className="flex-1 px-2 py-1 rounded text-sm font-bold outline-none"
            style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff',
              fontFamily: 'monospace',
            }}
            min={10}
            step={10}
          />
        </div>

        {/* Quick size buttons */}
        <div className="flex gap-1">
          {[50, 100, 500, 1000].map(size => (
            <button
              key={size}
              onClick={() => setTradeSize(size)}
              disabled={gamePhase === 'active' || gamePhase === 'sunk'}
              className="flex-1 py-0.5 rounded text-xs"
              style={{
                background: tradeSize === size ? 'rgba(0,212,255,0.2)' : 'rgba(0,212,255,0.05)',
                border: `1px solid ${tradeSize === size ? '#00d4ff' : 'rgba(0,212,255,0.15)'}`,
                color: tradeSize === size ? '#00d4ff' : '#555',
                cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
              }}
            >
              ${size}
            </button>
          ))}
        </div>

        {/* Fire / Retreat buttons */}
        <div className="flex gap-2">
          <button
            onClick={onFire}
            disabled={!canFire}
            className="flex-1 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: canFire
                ? selectedSide === 'short'
                  ? 'rgba(255,51,51,0.25)'
                  : 'rgba(0,255,136,0.25)'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${canFire ? (selectedSide === 'short' ? '#ff3333' : '#00ff88') : 'rgba(255,255,255,0.1)'}`,
              color: canFire
                ? selectedSide === 'short' ? '#ff3333' : '#00ff88'
                : '#333',
              boxShadow: canFire
                ? `0 0 20px ${selectedSide === 'short' ? 'rgba(255,51,51,0.4)' : 'rgba(0,255,136,0.4)'}`
                : 'none',
              cursor: canFire ? 'pointer' : 'not-allowed',
              animation: canFire ? 'pulse-glow 2s infinite' : 'none',
            }}
          >
            {isLoading ? '...' : '🔥 FIRE!'}
          </button>
          <button
            onClick={onRetreat}
            disabled={!canRetreat}
            className="flex-1 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: canRetreat ? 'rgba(255,136,0,0.35)' : 'rgba(255,136,0,0.05)',
              border: `2px solid ${canRetreat ? '#ff8800' : 'rgba(255,136,0,0.15)'}`,
              color: canRetreat ? '#ff8800' : '#333',
              cursor: canRetreat ? 'pointer' : 'not-allowed',
              boxShadow: canRetreat ? '0 0 20px rgba(255,136,0,0.5)' : 'none',
              animation: canRetreat ? 'pulse-glow 1.5s infinite' : 'none',
            }}
          >
            🚩 RETREAT
          </button>
        </div>

        {/* Status hint */}
        {gamePhase !== 'idle' && !canFire && (
          <div className="text-xs text-center" style={{ color: canRetreat ? '#ff8800' : '#555' }}>
            {canRetreat ? '⚠ CLOSE POSITION TO OPEN NEW ORDER' : gamePhase.toUpperCase()}
          </div>
        )}

        {/* Position summary */}
        {position && (
          <div
            className="text-xs px-2 py-1 rounded"
            style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.15)',
              color: '#666',
            }}
          >
            <span style={{ color: position.side === 'long' ? '#00ff88' : '#ff3333' }}>
              {position.side.toUpperCase()}
            </span>
            {' '}${position.size} @ {position.leverage}x
            {' '}
            <span style={{ color: position.unrealizedPnl >= 0 ? '#00ff88' : '#ff3333' }}>
              {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
