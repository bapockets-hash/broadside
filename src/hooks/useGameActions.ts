import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createPacificaClient } from '@/lib/pacifica';
import { soundEngine } from '@/lib/soundEngine';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';

/** Fetch authoritative position data from Pacifica and sync liq price + margin */
async function syncPosition(
  walletAddress: string,
  signFn: (msg: string) => Promise<string>,
  symbol: string
) {
  try {
    const client = createPacificaClient(walletAddress, signFn);
    const pos = await client.getPosition(symbol + '-PERP');
    if (!pos) return;
    const store = useGameStore.getState();
    if (!store.position) return;
    store.setPosition({
      ...store.position,
      liquidationPrice: pos.liquidationPrice > 0 ? pos.liquidationPrice : store.position.liquidationPrice,
      marginHealth: pos.marginHealth,
      margin: pos.margin,
      // Use Pacifica's created_at only if we don't already have an openedAt
      openedAt: store.position.openedAt || pos.openedAt,
    });
  } catch {
    // silently ignore — stale estimate stays
  }
}

function parseWalletError(err: unknown): string {
  const raw = err instanceof Error ? err.message
    : (err && typeof err === 'object' && 'message' in err)
      ? String((err as Record<string, unknown>).message)
      : String(err);
  if (raw.includes('UserKeyring not found')) {
    return 'Wallet locked — open Backpack/Phantom, unlock it, and try again';
  }
  if (raw.includes('User rejected') || raw.includes('user rejected')) {
    return 'Signature rejected';
  }
  return raw;
}

export function useFireCannons() {
  const { walletAddress, signFn } = usePacificaSigner();
  const {
    selectedSide,
    leverage,
    tradeSize,
    currentPrice,
    gamePhase,
    selectedSymbol,
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

      const client = createPacificaClient(walletAddress ?? 'demo-wallet', signFn);

      const order = await client.placeOrder({
        symbol: selectedSymbol + '-PERP',
        side: selectedSide === 'long' ? 'buy' : 'sell',
        size: tradeSize,
        leverage,
        orderType: 'market',
        currentPrice,
      });

      const entryPrice = order.entryPrice || currentPrice;
      const margin = order.margin ?? tradeSize;

      // Set initial position — liquidationPrice starts at 0 until syncPosition
      // fetches the authoritative value from Pacifica (~2.5s after order settles)
      setPosition({
        side: selectedSide,
        size: tradeSize,
        entryPrice,
        leverage,
        margin,
        marginHealth: 100,
        unrealizedPnl: 0,
        liquidationPrice: 0,
        openedAt: Date.now(),
      });

      setGamePhase('active');

      // Fetch authoritative liq price from Pacifica (delayed to let order settle)
      setTimeout(() => syncPosition(walletAddress ?? 'demo-wallet', signFn, selectedSymbol), 2500);
      setTimeout(() => syncPosition(walletAddress ?? 'demo-wallet', signFn, selectedSymbol), 8000);

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
      console.error('[Broadside] FIRE FAILED raw error:', err);
      const errorMsg = parseWalletError(err);
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
    selectedSymbol,
    walletAddress,
    signFn,
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
  const { walletAddress, signFn } = usePacificaSigner();
  const {
    position,
    selectedSymbol,
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
      const client = createPacificaClient(walletAddress ?? 'demo-wallet', signFn);
      const result = await client.closePosition(
        selectedSymbol + '-PERP',
        { side: position.side, margin: position.margin, leverage: position.leverage, entryPrice: position.entryPrice },
        useGameStore.getState().currentPrice,
      );

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
      console.error('[Broadside] RETREAT FAILED raw error:', err);
      const errorMsg = parseWalletError(err);
      addCombatLog(`RETREAT FAILED: ${errorMsg}`, 'info');
      soundEngine.playDefeat();
      clearPosition();
      setGamePhase('idle');
    } finally {
      setLoading(false);
    }
  }, [
    position,
    selectedSymbol,
    walletAddress,
    signFn,
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
    selectedSymbol,
  } = useGameStore();
  const { walletAddress, signFn } = usePacificaSigner();

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
      // Always read latest position directly from store to avoid stale ref overwrites
      const pos = useGameStore.getState().position;
      const phase = gamePhasRef.current;
      const price = currentPriceRef.current;

      if (!pos || phase !== 'active') return;

      // Track wave count (each interval tick with position = 1 wave)
      waveCountRef.current += 1;
      if (waveCountRef.current % 2 === 0) {
        // Update every ~6s
        updateMissionProgress('survive_waves', 1);
      }

      const tokenSize = (pos.margin * pos.leverage) / pos.entryPrice;
      const rawPnl = pos.side === 'long'
        ? (price - pos.entryPrice) * tokenSize
        : (pos.entryPrice - price) * tokenSize;
      const unrealizedPnl = Math.round(rawPnl * 100) / 100;

      // Distance from current price to liquidation as % of the margin range
      const liqPrice = pos.liquidationPrice;
      const distToLiq = Math.abs(price - liqPrice);
      const marginRange = Math.abs(pos.entryPrice - liqPrice);
      const marginHealth = liqPrice > 0 && marginRange > 0
        ? Math.max(0, Math.min(100, (distToLiq / marginRange) * 100))
        : 100;

      setPosition({ ...pos, unrealizedPnl, marginHealth });

      // Every ~30s sync authoritative liq price from Pacifica
      if (waveCountRef.current % 10 === 0 && walletAddress) {
        syncPosition(walletAddress, signFn, selectedSymbol);
      }

      // Liquidation check
      if (marginHealth < 2) {
        setGamePhase('sunk');
        addCombatLog('💥 SHIP SUNK! POSITION LIQUIDATED!', 'defeat');
        soundEngine.playExplosion();
        setTimeout(() => { clearPosition(); }, 5000);
        return;
      }

      // Low health warnings
      if (marginHealth < 20) {
        addCombatLog(`⚠ CRITICAL! Hull at ${Math.round(marginHealth)}%`, 'damage');
      } else if (marginHealth < 40) {
        addCombatLog(`TORPEDO HIT! Hull at ${Math.round(marginHealth)}%`, 'damage');
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [setPosition, setGamePhase, clearPosition, addCombatLog, updateMissionProgress, walletAddress, signFn, selectedSymbol]);
}
