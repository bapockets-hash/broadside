'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

// Max leverage per symbol sourced from https://api.pacifica.fi/api/v1/info
const SYMBOL_MAX_LEVERAGE: Record<string, number> = {
  // 50x
  BTC: 50, ETH: 50, USDJPY: 50, EURUSD: 50,
  // 20x
  SOL: 20, XRP: 20, HYPE: 20, SP500: 20,
  // 15x
  DOGE: 15,
  // 10x
  FARTCOIN: 10, ENA: 10, BNB: 10, SUI: 10, kBONK: 10, AAVE: 10,
  LINK: 10, kPEPE: 10, LTC: 10, LDO: 10, UNI: 10, CRV: 10, AVAX: 10,
  XPL: 10, PAXG: 10, ZEC: 10, TAO: 10, NEAR: 10, TRUMP: 10, BCH: 10,
  XMR: 10, ADA: 10, ARB: 10, NVDA: 10, XAG: 10, JUP: 10, CL: 10,
  GOOGL: 10, COPPER: 10, XAU: 10, PLTR: 10, NATGAS: 10, URNM: 10,
  HOOD: 10, CRCL: 10, PLATINUM: 10, TSLA: 10,
  // 5x
  PUMP: 5, WLFI: 5, ASTER: 5, PENGU: 5, VIRTUAL: 5, ZK: 5, STRK: 5,
  ICP: 5, WLD: 5, WIF: 5, LIT: 5, ZRO: 5,
  // 3x
  '2Z': 3, MON: 3, MEGA: 3, BP: 3, PIPPIN: 3,
};

function getMaxLeverage(symbol: string): number {
  return SYMBOL_MAX_LEVERAGE[symbol] ?? 10;
}

// Preset buttons tuned per leverage tier
function getLeveragePresets(maxLev: number): number[] {
  if (maxLev >= 50) return [1, 5, 10, 25, 50];
  if (maxLev >= 20) return [1, 3, 5, 10, 20];
  if (maxLev >= 15) return [1, 3, 5, 10, 15];
  if (maxLev >= 10) return [1, 2, 3, 5, 10];
  if (maxLev >= 5)  return [1, 2, 3, 5];
  return [1, 2, 3];
}

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
    selectedSymbol,
    setSelectedSymbol,
    allMarketPrices,
  } = useGameStore();

  const [selectorOpen, setSelectorOpen] = useState(false);

  // Category membership — anything Pacifica sends that isn't here falls into OTHER
  const CRYPTO  = new Set(['BTC','ETH','SOL','BNB','AVAX','XRP','DOGE','ADA','LINK','SUI','TON','NEAR','LTC','BCH','ICP','TAO','STRK','ZRO','WLD','ZK','ENA','ZEC','XMR','PAXG','VIRTUAL','LINEA','URNM','HYPE']);
  const MEME    = new Set(['kPEPE','kBONK','FARTCOIN','TRUMP','WIF','PENGU','WHITEWHALE','PIPPIN','MEGA','PUMP','MON','ASTER','WLFI','PROVE','LIT','XPL','2Z','CRCL','ZORA']);
  const DEFI    = new Set(['UNI','AAVE','CRV','LDO','ARB','JUP','ENA','ZK','STRK','ZRO','WLD','LINEA']);
  const STOCKS  = new Set(['TSLA','NVDA','GOOGL','PLTR','HOOD','BP']);
  const COMMODITIES = new Set(['XAU','XAG','CL','NATGAS','COPPER','PLATINUM','PAXG']);
  const FOREX   = new Set(['EURUSD','GBPUSD','USDJPY','USDKRW']);
  const INDICES = new Set(['SP500','QQQ','SPY']);

  const liveSymbols = Object.keys(allMarketPrices).sort();
  const categorized = new Set([...CRYPTO, ...MEME, ...DEFI, ...STOCKS, ...COMMODITIES, ...FOREX, ...INDICES]);

  const marketCategories = [
    { label: 'CRYPTO',      symbols: liveSymbols.filter(s => CRYPTO.has(s) && !DEFI.has(s)) },
    { label: 'MEME',        symbols: liveSymbols.filter(s => MEME.has(s)) },
    { label: 'DEFI',        symbols: liveSymbols.filter(s => DEFI.has(s)) },
    { label: 'STOCKS',      symbols: liveSymbols.filter(s => STOCKS.has(s)) },
    { label: 'COMMODITIES', symbols: liveSymbols.filter(s => COMMODITIES.has(s)) },
    { label: 'FOREX',       symbols: liveSymbols.filter(s => FOREX.has(s)) },
    { label: 'INDICES',     symbols: liveSymbols.filter(s => INDICES.has(s)) },
    { label: 'OTHER',       symbols: liveSymbols.filter(s => !categorized.has(s)) },
  ].filter(cat => cat.symbols.length > 0);

  const maxLev = getMaxLeverage(selectedSymbol);
  const leveragePresets = getLeveragePresets(maxLev);

  // Clamp leverage when switching to a symbol with a lower max
  useEffect(() => {
    if (leverage > maxLev) setLeverage(maxLev);
  }, [selectedSymbol, maxLev, leverage, setLeverage]);

  const fillPct = maxLev <= 1 ? 100 : ((leverage - 1) / (maxLev - 1)) * 100;
  const leverageColor = leverage > maxLev * 0.7
    ? (lightMode ? '#cc2222' : '#ff3333')
    : leverage > maxLev * 0.4
      ? (lightMode ? '#8a6200' : '#ffd700')
      : (lightMode ? '#007744' : '#00ff88');

  const canFire = selectedSide !== null && leverage >= 1 && tradeSize > 0 && !isLoading && gamePhase === 'idle';
  const canRetreat = position !== null && !isLoading && (gamePhase === 'active' || gamePhase === 'firing' || gamePhase === 'aiming');

  return (
    <div
      className="w-full flex items-stretch gap-0"
      onClick={() => setSelectorOpen(false)}
      style={{
        background: lightMode ? 'rgba(230, 245, 255, 0.92)' : 'rgba(5, 15, 30, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: lightMode ? '1px solid rgba(0,100,200,0.25)' : '1px solid rgba(0,212,255,0.3)',
        boxShadow: lightMode ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        minHeight: '120px',
        fontFamily: 'var(--font-share-tech-mono, monospace)',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {/* Left: Target & Stance */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2"
        style={{
          width: '280px',
          borderRight: lightMode ? '1px solid rgba(0,100,200,0.2)' : '1px solid rgba(0,212,255,0.15)',
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        <div className="text-xs tracking-widest mb-1" style={{ color: lightMode ? '#0055aa' : '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
          TARGET &amp; STANCE
        </div>

        {/* Asset selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!position) setSelectorOpen(v => !v); }}
            disabled={!!position}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 8px', borderRadius: '4px',
              background: lightMode ? 'rgba(0,100,200,0.08)' : 'rgba(0,212,255,0.05)',
              border: lightMode ? '1px solid rgba(0,100,200,0.4)' : '1px solid rgba(0,212,255,0.3)',
              color: lightMode ? '#0055aa' : '#00d4ff',
              cursor: position ? 'not-allowed' : 'pointer',
              opacity: position ? 0.6 : 1,
              width: '100%', textAlign: 'left',
              fontFamily: 'var(--font-share-tech-mono, monospace)',
              fontSize: '12px',
            }}
          >
            <span style={{ fontSize: '11px' }}>◎</span>
            <span style={{ fontWeight: 'bold' }}>{selectedSymbol}-PERP</span>
            {allMarketPrices[selectedSymbol] && (
              <span style={{ marginLeft: 'auto', color: lightMode ? '#556677' : '#666', fontSize: '10px' }}>
                ${allMarketPrices[selectedSymbol].price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            )}
            <span style={{ color: '#555', fontSize: '10px' }}>▼</span>
          </button>

          {selectorOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', bottom: '128px', left: '8px', zIndex: 200,
                width: '300px',
                background: lightMode ? 'rgba(240,248,255,0.98)' : 'rgba(5,12,25,0.98)',
                border: lightMode ? '1px solid rgba(0,100,200,0.3)' : '1px solid rgba(0,212,255,0.3)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
                fontFamily: 'var(--font-share-tech-mono, monospace)',
                maxHeight: '340px',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: '10px', color: lightMode ? '#0055aa' : '#00d4ff', letterSpacing: '0.2em', marginBottom: '10px', fontFamily: 'var(--font-orbitron, monospace)' }}>
                SELECT TARGET
              </div>
              {marketCategories.map(cat => (
                <div key={cat.label} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '9px', color: lightMode ? '#556677' : '#556', letterSpacing: '0.15em', marginBottom: '5px' }}>
                    {cat.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {cat.symbols.map(sym => {
                      const entry = allMarketPrices[sym];
                      const isSelected = sym === selectedSymbol;
                      return (
                        <button
                          key={sym}
                          onClick={() => { setSelectedSymbol(sym); setSelectorOpen(false); }}
                          style={{
                            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                            background: isSelected
                              ? (lightMode ? 'rgba(0,100,200,0.2)' : 'rgba(0,212,255,0.2)')
                              : (lightMode ? 'rgba(0,100,200,0.05)' : 'rgba(0,212,255,0.04)'),
                            border: `1px solid ${isSelected ? (lightMode ? '#0077cc' : '#00d4ff') : (lightMode ? 'rgba(0,100,200,0.2)' : 'rgba(0,212,255,0.12)')}`,
                            color: isSelected ? (lightMode ? '#0055aa' : '#00d4ff') : (lightMode ? '#334455' : '#99aabb'),
                            fontSize: '11px',
                            fontFamily: 'var(--font-share-tech-mono, monospace)',
                            fontWeight: isSelected ? 'bold' : 'normal',
                          }}
                        >
                          {sym}
                          {entry && (
                            <span style={{ display: 'block', fontSize: '8px', color: lightMode ? '#667788' : '#667', marginTop: '1px' }}>
                              ${entry.price < 1 ? entry.price.toFixed(4) : entry.price < 100 ? entry.price.toFixed(2) : Math.round(entry.price).toLocaleString()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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

        <div className="text-xs text-center" style={{ color: lightMode ? '#445566' : '#555' }}>
          {selectedSide === 'short' ? 'SHORT — Profit if price falls' :
           selectedSide === 'long' ? 'LONG — Profit if price rises' :
           'Select your battle stance'}
        </div>
      </div>

      {/* Center: Power Level */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2 flex-1"
        style={{ borderRight: lightMode ? '1px solid rgba(0,100,200,0.2)' : '1px solid rgba(0,212,255,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs tracking-widest" style={{ color: lightMode ? '#0055aa' : '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
            POWER LEVEL
          </div>
          <div
            className="text-xl font-bold"
            style={{ color: leverageColor, textShadow: lightMode ? 'none' : `0 0 10px ${leverageColor}` }}
          >
            {leverage}x
          </div>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative' }}>
          <style>{`
            .power-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 4px; outline: none; cursor: pointer; }
            .power-slider:disabled { cursor: not-allowed; opacity: 0.45; }
            .power-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 1px; height: 1px; background: transparent; }
            .power-slider::-moz-range-thumb { width: 1px; height: 1px; background: transparent; border: none; }
          `}</style>

          {/* Track + anchor wrapper so the anchor sits centered on the track */}
          <div style={{ position: 'relative', height: '8px' }}>
            <input
              type="range"
              className="power-slider"
              min={1}
              max={maxLev}
              step={1}
              value={leverage}
              onChange={e => setLeverage(Number(e.target.value))}
              disabled={gamePhase === 'active' || gamePhase === 'sunk'}
              style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(to right, ${leverageColor} ${fillPct}%, ${lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)'} ${fillPct}%)`,
              }}
            />

            {/* Anchor — sits on the track, grows with leverage */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${fillPct}%`,
                transform: 'translateX(-50%) translateY(-50%)',
                pointerEvents: 'none',
                fontSize: `${14 + (fillPct / 100) * 14}px`,
                lineHeight: 1,
                transition: 'font-size 0.08s, filter 0.08s',
                filter: fillPct > 70
                  ? `drop-shadow(0 0 ${5 + fillPct / 18}px rgba(255,60,60,0.9))`
                  : fillPct > 40
                    ? 'drop-shadow(0 0 4px rgba(255,215,0,0.8))'
                    : 'drop-shadow(0 0 3px rgba(0,255,136,0.6))',
                zIndex: 10,
              }}
            >
              💣
            </div>
          </div>

          {/* Tick marks at preset values */}
          <div style={{ position: 'relative', height: '24px', marginTop: '4px' }}>
            {leveragePresets.map(tick => {
              const pct = maxLev <= 1 ? 0 : ((tick - 1) / (maxLev - 1)) * 100;
              const isActive = leverage >= tick;
              return (
                <button
                  key={tick}
                  onClick={() => { if (gamePhase !== 'active' && gamePhase !== 'sunk') setLeverage(tick); }}
                  disabled={gamePhase === 'active' || gamePhase === 'sunk'}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    background: 'none',
                    border: 'none',
                    padding: '0 2px',
                    cursor: gamePhase === 'active' ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{
                    width: '1px',
                    height: '6px',
                    background: isActive ? leverageColor : (lightMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'),
                  }} />
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: leverage === tick ? leverageColor : (lightMode ? '#667788' : '#556'),
                    fontWeight: leverage === tick ? 'bold' : 'normal',
                    whiteSpace: 'nowrap',
                  }}>
                    {tick}x
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between text-xs" style={{ color: lightMode ? '#556677' : '#555', marginTop: '-2px' }}>
          <span>MINIMAL FORCE</span>
          <span style={{ color: maxLev >= 20 ? (lightMode ? '#cc2222' : '#ff4444') : (lightMode ? '#556677' : '#555') }}>
            MAX {maxLev}x
          </span>
        </div>
      </div>

      {/* Right: Fleet Orders */}
      <div
        className="flex flex-col justify-center px-4 py-3 gap-2"
        style={{ width: '240px', flexShrink: 0 }}
      >
        <div className="text-xs tracking-widest mb-1" style={{ color: lightMode ? '#0055aa' : '#00d4ff', fontFamily: 'var(--font-orbitron, monospace)' }}>
          FLEET ORDERS
        </div>

        {/* Trade size input */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: lightMode ? '#445566' : '#888' }}>SIZE $</span>
          <input
            type="number"
            value={tradeSize}
            onChange={(e) => setTradeSize(Math.max(10, Number(e.target.value)))}
            disabled={gamePhase === 'active' || gamePhase === 'sunk'}
            className="flex-1 px-2 py-1 rounded text-sm font-bold outline-none"
            style={{
              background: lightMode ? 'rgba(0,100,200,0.08)' : 'rgba(0,212,255,0.05)',
              border: lightMode ? '1px solid rgba(0,100,200,0.4)' : '1px solid rgba(0,212,255,0.3)',
              color: lightMode ? '#0055aa' : '#00d4ff',
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
                background: tradeSize === size
                  ? (lightMode ? 'rgba(0,100,200,0.2)' : 'rgba(0,212,255,0.2)')
                  : (lightMode ? 'rgba(0,100,200,0.06)' : 'rgba(0,212,255,0.05)'),
                border: `1px solid ${tradeSize === size
                  ? (lightMode ? '#0077cc' : '#00d4ff')
                  : (lightMode ? 'rgba(0,100,200,0.25)' : 'rgba(0,212,255,0.15)')}`,
                color: tradeSize === size ? (lightMode ? '#0055aa' : '#00d4ff') : (lightMode ? '#445566' : '#555'),
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
          <div className="text-xs text-center" style={{ color: canRetreat ? '#ff8800' : (lightMode ? '#445566' : '#555') }}>
            {canRetreat ? '⚠ CLOSE POSITION TO OPEN NEW ORDER' : gamePhase.toUpperCase()}
          </div>
        )}

        {/* Position summary */}
        {position && (
          <div
            className="text-xs px-2 py-1 rounded"
            style={{
              background: lightMode ? 'rgba(0,100,200,0.06)' : 'rgba(0,212,255,0.05)',
              border: lightMode ? '1px solid rgba(0,100,200,0.2)' : '1px solid rgba(0,212,255,0.15)',
              color: lightMode ? '#445566' : '#666',
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
