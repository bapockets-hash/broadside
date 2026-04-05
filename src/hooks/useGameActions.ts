import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { createPacificaClient } from '@/lib/pacifica';
import { soundEngine } from '@/lib/soundEngine';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';

function genPositionId(): string {
  return 'pos-' + Math.random().toString(36).slice(2, 10);
}

/** Fetch authoritative position data from Pacifica and sync liq price + margin */
async function syncPosition(
  walletAddress: string,
  signFn: (msg: string) => Promise<string>,
  symbol: string,
  positionId: string,
) {
  try {
    const client = createPacificaClient(walletAddress, signFn);
    const pos = await client.getPosition(symbol + '-PERP');
    if (!pos) return;
    const store = useGameStore.getState();
    const existing = store.positions.find(p => p.id === positionId);
    if (!existing) return;

    // For cross-margin, Pacifica returns margin=0 — keep the user's trade size as margin
    const margin = pos.margin > 0 ? pos.margin : existing.margin;

    // Use API liq price if valid; otherwise keep existing
    const liqPrice = pos.liquidationPrice > 0 ? pos.liquidationPrice : existing.liquidationPrice;

    // Use authoritative token amount from API if available
    const size = pos.size > 0 ? pos.size : existing.size;

    store.upsertPosition({
      ...existing,
      size,
      liquidationPrice: liqPrice,
      margin,
      openedAt: existing.openedAt || pos.openedAt,
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
    marginMode,
    currentPrice,
    gamePhase,
    selectedSymbol,
    positions,
    setLoading,
    setGamePhase,
    upsertPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
    recordSymbolLeverage,
  } = useGameStore();

  const fire = useCallback(async () => {
    if (!selectedSide || leverage < 1 || tradeSize <= 0) {
      addCombatLog('INVALID ORDER: Set side and leverage first', 'info');
      return;
    }

    if (gamePhase === 'aiming' || gamePhase === 'firing') {
      addCombatLog('CANNOT FIRE: Position already active', 'info');
      return;
    }

    if (positions.some(p => p.symbol === selectedSymbol)) {
      addCombatLog('POSITION ALREADY OPEN FOR ' + selectedSymbol, 'info');
      return;
    }

    // Init sound on user gesture
    soundEngine.init();

    setLoading(true);
    setGamePhase('aiming');
    addCombatLog(`ACQUIRING TARGET: ${selectedSide === 'short' ? 'ATTACK' : 'DEFEND'} @ ${leverage}x`, 'info');

    const positionId = genPositionId();

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setGamePhase('firing');

      // Play cannon fire sound
      soundEngine.playCannonFire();

      // Persist leverage for this symbol so external positions can be reconciled
      recordSymbolLeverage(selectedSymbol, leverage);

      const client = createPacificaClient(walletAddress ?? 'demo-wallet', signFn);

      const order = await client.placeOrder({
        symbol: selectedSymbol + '-PERP',
        side: selectedSide === 'long' ? 'buy' : 'sell',
        size: tradeSize,
        leverage,
        orderType: 'market',
        currentPrice,
        marginMode,
      });

      const entryPrice = order.entryPrice || currentPrice;
      const margin = order.margin ?? tradeSize;
      // size is always token amount: notional / price
      const tokenSize = parseFloat(((tradeSize * leverage) / entryPrice).toFixed(8));

      // Set initial position — liquidationPrice starts at 0 until syncPosition
      // fetches the authoritative value from Pacifica (~2.5s after order settles)
      upsertPosition({
        id: positionId,
        symbol: selectedSymbol,
        side: selectedSide,
        size: tokenSize,
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
      setTimeout(() => syncPosition(walletAddress ?? 'demo-wallet', signFn, selectedSymbol, positionId), 2500);
      setTimeout(() => syncPosition(walletAddress ?? 'demo-wallet', signFn, selectedSymbol, positionId), 8000);

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
    marginMode,
    currentPrice,
    gamePhase,
    selectedSymbol,
    positions,
    walletAddress,
    signFn,
    setLoading,
    setGamePhase,
    upsertPosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
    recordSymbolLeverage,
  ]);

  return fire;
}

export function useClosePosition(position: import('@/store/gameStore').Position | null) {
  const { walletAddress, signFn } = usePacificaSigner();
  const {
    setLoading,
    setGamePhase,
    removePosition,
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
      const currentPrice = useGameStore.getState().allMarketPrices[position.symbol]?.price ?? useGameStore.getState().currentPrice;
      const result = await client.closePosition(
        position.symbol + '-PERP',
        { side: position.side, size: position.size, entryPrice: position.entryPrice },
        currentPrice,
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

      removePosition(position.id);
      const remaining = useGameStore.getState().positions;
      setGamePhase(remaining.length > 0 ? 'active' : 'idle');

      if (result.success || pnl !== undefined) {
        addCombatLog(
          `RETREAT COMPLETE. PnL: ${pnlFormatted}`,
          pnl >= 0 ? 'victory' : 'defeat'
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.error('[Broadside] RETREAT FAILED raw error:', err);
      const errorMsg = parseWalletError(err);
      addCombatLog(`RETREAT FAILED: ${errorMsg}`, 'info');
      soundEngine.playDefeat();
      removePosition(position.id);
      const remaining = useGameStore.getState().positions;
      setGamePhase(remaining.length > 0 ? 'active' : 'idle');
    } finally {
      setLoading(false);
    }
  }, [
    position,
    walletAddress,
    signFn,
    setLoading,
    setGamePhase,
    removePosition,
    addCombatLog,
    addXP,
    updateMissionProgress,
    updateSessionStats,
  ]);

  return retreat;
}

export function useRetreat() {
  const selectedSymbol = useGameStore(s => s.selectedSymbol);
  const closePosition = useClosePosition(
    useGameStore(s => s.positions.find(p => p.symbol === selectedSymbol) ?? null)
  );
  return closePosition;
}

export function usePositionMonitor() {
  const {
    currentPrice,
    upsertPosition,
    setGamePhase,
    removePosition,
    addCombatLog,
    gamePhase,
    incrementCombo,
    updateMissionProgress,
  } = useGameStore();
  const { walletAddress, signFn } = usePacificaSigner();

  const gamePhasRef = useRef(gamePhase);
  const currentPriceRef = useRef(currentPrice);
  const consecutiveFavorableTicksRef = useRef(0);
  const waveCountRef = useRef(0);
  const lastPriceRef = useRef(currentPrice);

  useEffect(() => {
    gamePhasRef.current = gamePhase;
  }, [gamePhase]);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Track consecutive favorable ticks for combo
  useEffect(() => {
    const selectedSymbol = useGameStore.getState().selectedSymbol;
    const pos = useGameStore.getState().positions.find(p => p.symbol === selectedSymbol) ?? null;
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
      const state = useGameStore.getState();
      const allPositions = state.positions;
      const phase = gamePhasRef.current;
      if (!allPositions.length || phase !== 'active') return;

      // Track wave count (each interval tick with position = 1 wave)
      waveCountRef.current += 1;
      if (waveCountRef.current % 2 === 0) {
        // Update every ~6s
        updateMissionProgress('survive_waves', 1);
      }

      for (const pos of allPositions) {
        const price = state.allMarketPrices[pos.symbol]?.price ?? state.currentPrice;
        // size is always token amount
        const tokenSize = pos.size;
        const rawPnl = pos.side === 'long'
          ? (price - pos.entryPrice) * tokenSize
          : (pos.entryPrice - price) * tokenSize;
        const unrealizedPnl = Math.round(rawPnl * 100) / 100;
        const liqPrice = pos.liquidationPrice;
        const distToLiq = Math.abs(price - liqPrice);
        const marginRange = Math.abs(pos.entryPrice - liqPrice);
        const marginHealth = liqPrice > 0 && marginRange > 0
          ? Math.max(0, Math.min(100, (distToLiq / marginRange) * 100))
          : 100;

        upsertPosition({ ...pos, unrealizedPnl, marginHealth });

        if (waveCountRef.current % 10 === 0 && walletAddress) {
          syncPosition(walletAddress, signFn, pos.symbol, pos.id);
        }

        if (marginHealth < 2) {
          setGamePhase('sunk');
          addCombatLog('💥 SHIP SUNK! POSITION LIQUIDATED!', 'defeat');
          soundEngine.playExplosion();
          setTimeout(() => { removePosition(pos.id); }, 5000);
          continue;
        }

        if (marginHealth < 20) {
          addCombatLog(`⚠ CRITICAL! Hull at ${Math.round(marginHealth)}%`, 'damage');
        } else if (marginHealth < 40) {
          addCombatLog(`TORPEDO HIT! Hull at ${Math.round(marginHealth)}%`, 'damage');
        }
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [upsertPosition, setGamePhase, removePosition, addCombatLog, updateMissionProgress, walletAddress, signFn]);
}
