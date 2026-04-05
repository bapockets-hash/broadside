'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';

export default function StatsPanel() {
  const { currentPrice, priceHistory, positions, selectedSymbol, leverage, selectedSide } = useGameStore();
  const position = positions.find(p => p.symbol === selectedSymbol) ?? null;

  // Calculate 24h change (simulated)
  const firstPrice = priceHistory[0] || currentPrice;
  const priceChange = currentPrice - firstPrice;
  const priceChangePct = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  // Mini chart data
  const { chartMin, chartMax, chartRange } = useMemo(() => {
    const min = Math.min(...priceHistory);
    const max = Math.max(...priceHistory);
    return { chartMin: min, chartMax: max, chartRange: max - min || 1 };
  }, [priceHistory]);

  const getChartY = (price: number, h: number) =>
    h - ((price - chartMin) / chartRange) * h;

  const chartW = 140;
  const chartH = 50;

  const pathPoints = priceHistory.map((p, i) => {
    const x = (i / (priceHistory.length - 1)) * chartW;
    const y = getChartY(p, chartH);
    return `${x},${y}`;
  });

  const svgPath = `M ${pathPoints.join(' L ')}`;
  const svgArea = `M ${pathPoints[0]} L ${pathPoints.join(' L ')} L ${chartW},${chartH} L 0,${chartH} Z`;

  return (
    <div
      className="flex flex-col gap-3 p-3 font-mono overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, #0d1f3a 0%, #0a1628 100%)',
        borderLeft: '1px solid rgba(0,212,255,0.2)',
        width: '200px',
        flexShrink: 0,
      }}
    >
      {/* Price chart */}
      <div>
        <div className="text-xs tracking-widest mb-2" style={{ color: '#00d4ff' }}>
          BTC PRICE FEED
        </div>
        <div
          className="rounded p-2"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.15)' }}
        >
          <div className="flex justify-between items-start mb-1">
            <div>
              <div className="text-sm font-bold" style={{ color: '#ffd700' }}>
                ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div
                className="text-xs"
                style={{ color: priceChange >= 0 ? '#00ff88' : '#ff3333' }}
              >
                {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePct).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Mini sparkline */}
          <svg width={chartW} height={chartH} className="overflow-visible">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={priceChange >= 0 ? '#00ff88' : '#ff3333'} stopOpacity="0.3" />
                <stop offset="100%" stopColor={priceChange >= 0 ? '#00ff88' : '#ff3333'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={svgArea} fill="url(#chartGrad)" />
            <path
              d={svgPath}
              fill="none"
              stroke={priceChange >= 0 ? '#00ff88' : '#ff3333'}
              strokeWidth="1.5"
            />
            {/* Current price dot */}
            <circle
              cx={chartW}
              cy={getChartY(currentPrice, chartH)}
              r="3"
              fill={priceChange >= 0 ? '#00ff88' : '#ff3333'}
            />
          </svg>
        </div>
      </div>

      {/* Market stats */}
      <div>
        <div className="text-xs tracking-widest mb-2" style={{ color: '#00d4ff' }}>
          MARKET INTEL
        </div>
        <div
          className="rounded p-2 space-y-1.5 text-xs"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.15)' }}
        >
          {[
            { label: '24H HIGH', value: `$${(currentPrice * 1.023).toFixed(0)}`, color: '#00ff88' },
            { label: '24H LOW', value: `$${(currentPrice * 0.977).toFixed(0)}`, color: '#ff3333' },
            { label: 'FUNDING', value: '+0.01%', color: '#ffd700' },
            { label: 'OI', value: '$284M', color: '#aaa' },
            { label: 'VOL 24H', value: '$1.2B', color: '#aaa' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span style={{ color: '#555' }}>{label}</span>
              <span style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Position estimator */}
      {!position && selectedSide && (
        <div>
          <div className="text-xs tracking-widest mb-2" style={{ color: '#00d4ff' }}>
            POSITION ESTIMATE
          </div>
          <div
            className="rounded p-2 space-y-1.5 text-xs"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.15)' }}
          >
            <div className="flex justify-between">
              <span style={{ color: '#555' }}>SIDE</span>
              <span style={{ color: selectedSide === 'long' ? '#00ff88' : '#ff3333' }}>
                {selectedSide.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#555' }}>LEV</span>
              <span style={{ color: '#ffd700' }}>{leverage}x</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#555' }}>LIQ DIST</span>
              <span style={{ color: '#ff8800' }}>
                {((1 / leverage) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Battle tips */}
      <div>
        <div className="text-xs tracking-widest mb-2" style={{ color: '#00d4ff' }}>
          ADMIRAL WISDOM
        </div>
        <div
          className="rounded p-2 text-xs leading-relaxed"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(0,212,255,0.15)',
            color: '#4a7a9b',
          }}
        >
          {[
            'High leverage = high risk. Your ship can sink fast.',
            'Retreat before your hull reaches 20%.',
            'Watch the waves — price momentum matters.',
            'Defend the fleet with stop-losses.',
          ][Math.floor(Date.now() / 30000) % 4]}
        </div>
      </div>

      {/* Pacifica branding */}
      <div
        className="mt-auto text-center py-2 rounded"
        style={{ border: '1px solid rgba(255,215,0,0.15)' }}
      >
        <div className="text-xs" style={{ color: '#ffd700', fontSize: '10px' }}>
          ⚓ POWERED BY
        </div>
        <div className="text-xs font-bold tracking-widest" style={{ color: '#ffd700' }}>
          PACIFICA DEX
        </div>
        <div style={{ color: '#333', fontSize: '9px' }} className="text-xs">
          Arbitrum Network
        </div>
      </div>
    </div>
  );
}
