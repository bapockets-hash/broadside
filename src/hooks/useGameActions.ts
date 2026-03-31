import { useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useGameStore } from '@/store/gameStore';
import { createPacificaClient } from '@/lib/pacifica';
import { soundEngine } from '@/lib/soundEngine';

// Always call usePrivy unconditionally — conditional hook calls violate Rules of Hooks
function useWalletInfo() {
  const { user, signMessage } = usePrivy();
  return { user, signMessage };
}

export function useFireCannons() {
  const { user, signMessage } = useWalletInfo();
  const {
    selectedSide,
    leverage,
    tradeSize,
    currentPrice,
    gamePhase,
    setLoading,
    setGamePhase,
    setPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
  } = useGameStore();

  const fire = useCallback(async () => {
    if (!selectedSide || leverage < 1 || tradeSize <= 0) {
      addCombatLog('INVALID ORDER: Set side and leverage first', 'info');
      return;
    }

    if (gamePhase !== 'idle') {
      addCombatLog('CANNOT FIRE: Position already active', 'info');
      return;
    }

    // Init sound on user gesture
    soundEngine.init();

    setLoading(true);
    setGamePhase('aiming');
    addCombatLog(`ACQUIRING TARGET: ${selectedSide === 'short' ? 'ATTACK' : 'DEFEND'} @ ${leverage}x`, 'info');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setGamePhase('firing');

      // Play cannon fire sound
      soundEngine.playCannonFire();

      const walletAddress = user?.wallet?.address || 'demo-wallet';
      const hasWallet = !!user?.wallet?.address;

      const signFn = async (message: string): Promise<string> => {
        if (!hasWallet || !signMessage) return 'demo-sig';
        try {
          const result = await signMessage({ message });
          return result.signature;
        } catch {
          return 'demo-sig';
        }
      };

      const client = createPacificaClient(walletAddress, signFn);

      const order = await client.placeOrder({
        symbol: 'BTC-PERP',
        side: selectedSide === 'long' ? 'buy' : 'sell',
        size: tradeSize,
        leverage,
        orderType: 'market',
        currentPrice,
      });

      // Calculate liquidation price
      const liqMove = (1 / leverage) * currentPrice;
      const liquidationPrice =
        selectedSide === 'long'
          ? currentPrice - liqMove
          : currentPrice + liqMove;

      setPosition({
        side: selectedSide,
        size: tradeSize,
        entryPrice: order.entryPrice || currentPrice,
        leverage,
        marginHealth: 100,
        unrealizedPnl: 0,
        liquidationPrice: Math.round(liquidationPrice),
      });

      setGamePhase('active');

      addCombatLog(
        `${selectedSide === 'short' ? '⚔ CANNONS FIRED!' : '🛡 SHIELDS RAISED!'} ${leverage}x $${tradeSize}`,
        selectedSide === 'short' ? 'attack' : 'defend'
      );

      // XP and mission tracking
      addXP(10);
      updateMissionProgress('trades', 1);
      if (leverage === 10) {
        updateMissionProgress('leverage', 1);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addCombatLog(`FIRE FAILED: ${errorMsg}`, 'info');
      setGamePhase('idle');
    } finally {
      setLoading(false);
    }
  }, [
    selectedSide,
    leverage,
    tradeSize,
    currentPrice,
    gamePhase,
    user,
    signMessage,
    setLoading,
    setGamePhase,
    setPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
  ]);

  return fire;
}

export function useRetreat() {
  const { user, signMessage } = useWalletInfo();
  const {
    position,
    setLoading,
    setGamePhase,
    clearPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
    updateSessionStats,
  } = useGameStore();

  const retreat = useCallback(async () => {
    if (!position) {
      addCombatLog('NO ACTIVE POSITION TO CLOSE', 'info');
      return;
    }

    soundEngine.init();
    setLoading(true);
    setGamePhase('retreating');
    addCombatLog('🚩 FLEET RETREATING...', 'info');

    try {
      const walletAddress = user?.wallet?.address || 'demo-wallet';
      const hasWallet = !!user?.wallet?.address;

      const signFn = async (message: string): Promise<string> => {
        if (!hasWallet || !signMessage) return 'demo-sig';
        try {
          const result = await signMessage({ message });
          return result.signature;
        } catch {
          return 'demo-sig';
        }
      };

      const client = createPacificaClient(walletAddress, signFn);
      const result = await client.closePosition('BTC-PERP', useGameStore.getState().currentPrice);

      const pnl = position.unrealizedPnl;
      const pnlFormatted = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;

      // Play sound based on outcome
      if (pnl > 0) {
        soundEngine.playVictory();
      } else {
        soundEngine.playDefeat();
      }

      // XP and mission tracking
      const xpEarned = Math.max(0, Math.floor(pnl / 10));
      if (xpEarned > 0) addXP(xpEarned);
      if (pnl > 0) updateMissionProgress('profit', pnl);

      // Session stats
      updateSessionStats(pnl, pnl > 0);

      clearPosition();

      if (result.success || pnl !== undefined) {
        addCombatLog(
          `RETREAT COMPLETE. PnL: ${pnlFormatted}`,
          pnl >= 0 ? 'victory' : 'defeat'
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      setGamePhase('idle');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addCombatLog(`RETREAT FAILED: ${errorMsg}`, 'info');
      soundEngine.playDefeat();
      clearPosition();
      setGamePhase('idle');
    } finally {
      setLoading(false);
    }
  }, [
    position,
    user,
    signMessage,
    setLoading,
    setGamePhase,
    clearPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
    updateSessionStats,
  ]);

  return retreat;
}

export function usePositionMonitor() {
  const { user } = useWalletInfo();
  const {
    position,
    currentPrice,
    setPosition,
    setGamePhase,
    clearPosition,
    addCombatLog,
    gamePhase,
    incrementCombo,
    updateMissionProgress,
  } = useGameStore();

  const positionRef = useRef(position);
  const gamePhasRef = useRef(gamePhase);
  const currentPriceRef = useRef(currentPrice);
  const consecutiveFavorableTicksRef = useRef(0);
  const waveCountRef = useRef(0);
  const lastPriceRef = useRef(currentPrice);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    gamePhasRef.current = gamePhase;
  }, [gamePhase]);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Track consecutive favorable ticks for combo
  useEffect(() => {
    const pos = positionRef.current;
    const phase = gamePhasRef.current;
    if (!pos || phase !== 'active') {
      consecutiveFavorableTicksRef.current = 0;
      return;
    }

    const prevPrice = lastPriceRef.current;
    const curPrice = currentPrice;
    const isFavorable =
      (pos.side === 'long' && curPrice > prevPrice) ||
      (pos.side === 'short' && curPrice < prevPrice);

    if (isFavorable) {
      consecutiveFavorableTicksRef.current += 1;
      if (consecutiveFavorableTicksRef.current >= 3) {
        incrementCombo();
        soundEngine.playCombo(useGameStore.getState().combo);
        consecutiveFavorableTicksRef.current = 0;
      }
    } else {
      consecutiveFavorableTicksRef.current = 0;
    }

    lastPriceRef.current = curPrice;
  }, [currentPrice, incrementCombo]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const pos = positionRef.current;
      const phase = gamePhasRef.current;
      const price = currentPriceRef.current;

      if (!pos || phase !== 'active') return;

      // Track wave count (each interval tick with position = 1 wave)
      waveCountRef.current += 1;
      if (waveCountRef.current % 2 === 0) {
        // Update every ~6s
        updateMissionProgress('survive_waves', 1);
      }

      // Check for liquidation
      if (pos.marginHealth <= 0 || pos.marginHealth < 2) {
        setGamePhase('sunk');
        addCombatLog('💥 SHIP SUNK! POSITION LIQUIDATED!', 'defeat');
        soundEngine.playExplosion();
        setTimeout(() => {
          clearPosition();
        }, 5000);
        return;
      }

      // Low health warnings
      if (pos.marginHealth < 20) {
        addCombatLog(`⚠ CRITICAL! Hull at ${pos.marginHealth}%`, 'damage');
      } else if (pos.marginHealth < 40) {
        addCombatLog(`TORPEDO HIT! Hull at ${pos.marginHealth}%`, 'damage');
      }

      // Try to fetch real position from API
      try {
        const walletAddress = user?.wallet?.address;
        if (!walletAddress) return;

        const { createPacificaClient: createClient } = await import('@/lib/pacifica');
        const client = createClient(walletAddress, async () => 'demo-sig');
        const apiPosition = await client.getPosition('BTC-PERP');

        if (apiPosition) {
          setPosition({
            side: apiPosition.side,
            size: apiPosition.size,
            entryPrice: apiPosition.entryPrice,
            leverage: apiPosition.leverage,
            marginHealth: apiPosition.marginHealth,
            unrealizedPnl: apiPosition.unrealizedPnl,
            liquidationPrice: apiPosition.liquidationPrice,
          });
        }
      } catch {
        // Silently continue with client-side calculation
        void price;
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [user, setPosition, setGamePhase, clearPosition, addCombatLog, updateMissionProgress]);
}
