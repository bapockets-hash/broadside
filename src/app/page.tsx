'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store/gameStore';
import { createPriceWebSocket } from '@/lib/priceWebSocket';
import { useFireCannons, useRetreat, usePositionMonitor } from '@/hooks/useGameActions';
import CommandPanel from '@/components/game/CommandPanel';
import HUD from '@/components/game/HUD';
import Leaderboard from '@/components/game/Leaderboard';
import AdmiralPanel from '@/components/game/AdmiralPanel';
import TimeframeSelector from '@/components/game/TimeframeSelector';

// Dynamic import for Phaser to avoid SSR issues
const BattleshipGame = dynamic(
  () => import('@/components/game/BattleshipGame'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full flex items-center justify-center font-mono"
        style={{ background: '#0a1628' }}
      >
        <div style={{ color: '#00d4ff' }}>LOADING BATTLE SYSTEMS...</div>
      </div>
    ),
  }
);

function GameContent() {
  const { setCurrentPrice, addPriceHistory } = useGameStore();
  const wsRef = useRef<ReturnType<typeof createPriceWebSocket> | null>(null);

  const fireCannons = useFireCannons();
  const retreat = useRetreat();
  usePositionMonitor();

  // Always start price feed — WebSocket with fallback to simulation
  useEffect(() => {
    const ws = createPriceWebSocket('BTC-PERP', (price) => {
      setCurrentPrice(price);
      addPriceHistory(price);
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [setCurrentPrice, addPriceHistory]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#0a1628' }}
    >
      {/* Main game area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Leaderboard */}
        <div className="h-full" style={{ width: '176px', flexShrink: 0 }}>
          <Leaderboard />
        </div>

        {/* Center: Game canvas + HUD + timeframe selector */}
        <div className="flex-1 relative overflow-hidden">
          <BattleshipGame />
          <HUD />
          <TimeframeSelector />
        </div>

        {/* Right: Admiral Panel */}
        <AdmiralPanel />
      </div>

      {/* Bottom: Command panel */}
      <div className="flex-shrink-0">
        <CommandPanel
          onFire={fireCannons}
          onRetreat={retreat}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="h-full">
      <GameContent />
    </div>
  );
}
