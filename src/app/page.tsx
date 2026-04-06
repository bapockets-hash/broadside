'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store/gameStore';
import { createPriceWebSocket } from '@/lib/priceWebSocket';
import { fetchMarketInfo } from '@/lib/pacifica';
import { useFireCannons, useRetreat, usePositionMonitor } from '@/hooks/useGameActions';
import { useAccountPositions } from '@/hooks/useAccountPositions';
import { useHistoricalPrices } from '@/hooks/useHistoricalPrices';
import CommandPanel from '@/components/game/CommandPanel';
import HUD from '@/components/game/HUD';
import Leaderboard from '@/components/game/Leaderboard';
import AdmiralPanel from '@/components/game/AdmiralPanel';
import TimeframeSelector from '@/components/game/TimeframeSelector';
import ConnectWallet from '@/components/ConnectWallet';
import TutorialOverlay from '@/components/game/TutorialOverlay';

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
  const { setCurrentPrice, addPriceHistory, setMarketStats, setAllMarketPrices } = useGameStore();
  const wsRef = useRef<ReturnType<typeof createPriceWebSocket> | null>(null);
  // True once Pacifica all-market data has arrived — onPrice becomes a no-op
  // because setAllMarketPrices already handles currentPrice + priceHistory for
  // the selected symbol. onPrice is only needed for the Binance/simulation fallback.
  const pacificaActiveRef = useRef(false);

  const fireCannons = useFireCannons();
  const retreat = useRetreat();
  usePositionMonitor();
  useAccountPositions();
  useHistoricalPrices();

  // Pre-warm market info cache so first trade has no extra latency
  useEffect(() => { fetchMarketInfo(); }, []);

  // Always start price feed — WebSocket with fallback to simulation
  useEffect(() => {
    pacificaActiveRef.current = false;

    const ws = createPriceWebSocket(
      'BTC-PERP',
      (price) => {
        // Skip when Pacifica all-market feed is active — setAllMarketPrices
        // handles price history for whatever symbol is selected. Using this
        // callback too would inject BTC prices into non-BTC chart buffers.
        if (pacificaActiveRef.current) return;
        setCurrentPrice(price);
        addPriceHistory(price);
      },
      (stats) => setMarketStats(stats),
      (entries) => {
        pacificaActiveRef.current = true;
        setAllMarketPrices(entries);
      },
    );

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [setCurrentPrice, addPriceHistory, setMarketStats, setAllMarketPrices]);

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
        <div data-tutorial-id="game-canvas" className="flex-1 relative overflow-hidden">
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
      <ConnectWallet />
      <GameContent />
      <TutorialOverlay />
    </div>
  );
}
