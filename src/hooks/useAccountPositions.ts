'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';
import { createPacificaClient, fetchMarketInfo } from '@/lib/pacifica';

const WS_URL = 'wss://ws.pacifica.fi/ws';

interface PositionFrame {
  s: string;        // symbol — may be 'SOL' or 'SOL-PERP'
  d: string;        // direction: "bid" (long) | "ask" (short)
  a: string;        // amount in base tokens
  p: string;        // average entry price
  m: string;        // margin (0 for cross-margin, > 0 for isolated)
  f: string;        // cumulative funding fee
  i: boolean;       // is isolated margin?
  l: string | null; // liquidation price in USD — negative for cross-margin longs
  t: number;        // timestamp ms
}

function applyFrame(frame: PositionFrame) {
  const store = useGameStore.getState();
  const symbol = frame.s.replace('-PERP', '');
  const existingPos = store.positions.find(p => p.symbol === symbol);

  const entryPrice = parseFloat(frame.p);
  const tokenAmount = parseFloat(frame.a);
  const margin = parseFloat(frame.m || '0');
  const side = frame.d === 'bid' ? 'long' : 'short';

  // Zero amount = position closed externally — remove from store.
  // But ignore transient zero-amount frames that arrive during order settlement
  // (Pacifica sends amount=0 briefly while the fill is processing).
  // Only remove if the position has been open for more than 10 seconds.
  if (!tokenAmount) {
    if (existingPos) {
      const ageMs = Date.now() - (existingPos.openedAt ?? 0);
      if (ageMs > 10_000) store.removePosition(existingPos.id);
    }
    return false;
  }

  if (!entryPrice) return false;

  let liquidationPrice = existingPos?.liquidationPrice ?? 0;
  if (frame.l != null && frame.l !== '') {
    const liq = parseFloat(frame.l);
    const isValid = liq > 0 && (side === 'long' ? liq < entryPrice : liq > entryPrice);
    if (isValid) liquidationPrice = liq;
  }

  const posPrice = store.allMarketPrices[symbol]?.price ?? store.currentPrice;
  const unrealizedPnl = Math.round(
    (side === 'long'
      ? (posPrice - entryPrice) * tokenAmount
      : (entryPrice - posPrice) * tokenAmount
    ) * 100
  ) / 100;

  if (existingPos) {
    // Use persisted leverage if existing position has placeholder 1x and we have a better value
    const leverage = (existingPos.leverage <= 1 && store.symbolLeverages[symbol])
      ? store.symbolLeverages[symbol]
      : existingPos.leverage;
    store.upsertPosition({ ...existingPos, size: tokenAmount, entryPrice, liquidationPrice, unrealizedPnl, leverage });
  } else {
    // Position exists on Pacifica but not in local store — create it
    const derivedLeverage = margin > 0
      ? Math.max(1, Math.round((tokenAmount * entryPrice) / margin))
      : (store.symbolLeverages[symbol] ?? 1);
    const leverage = store.symbolLeverages[symbol] ?? derivedLeverage;
    store.upsertPosition({
      id: `pac-${symbol}`,
      symbol,
      side,
      size: tokenAmount,
      entryPrice,
      leverage,
      margin: margin > 0 ? margin : 0,
      marginHealth: 100,
      unrealizedPnl,
      liquidationPrice,
      openedAt: frame.t || Date.now(),
    });
    // Ensure game phase reflects active positions
    if (store.gamePhase === 'idle') store.setGamePhase('active');
  }
  return true;
}

/**
 * Subscribes to Pacifica's account_positions WebSocket stream.
 * Buffers frames that arrive before upsertPosition is called (WS/HTTP race),
 * then applies them the moment the position exists in the store.
 */
export function useAccountPositions() {
  const { walletAddress, signFn } = usePacificaSigner();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!walletAddress || typeof window === 'undefined') return;

    let active = true;

    // Seed store with any positions already open on Pacifica
    async function seedPositions() {
      try {
        const client = createPacificaClient(walletAddress, signFn);
        const [all, accountSettings, marketInfo] = await Promise.all([
          client.getAllPositions(),
          client.getAccountSettings(),
          fetchMarketInfo(),
        ]);
        const store = useGameStore.getState();
        // Store authoritative leverages from account settings
        for (const [symbol, setting] of Object.entries(accountSettings)) {
          if (setting.leverage > 1) store.recordSymbolLeverage(symbol, setting.leverage);
        }
        for (const pos of all) {
          if (!store.positions.find(p => p.symbol === pos.symbol)) {
            // Priority: explicit account setting → persisted from our app → derived from margin → max leverage (default on Pacifica)
            const maxLeverage = marketInfo[pos.symbol + '-PERP']?.maxLeverage ?? marketInfo[pos.symbol]?.maxLeverage ?? 1;
            const leverage = accountSettings[pos.symbol]?.leverage
              ?? store.symbolLeverages[pos.symbol]
              ?? (pos.margin > 0 ? pos.leverage : maxLeverage);
            store.upsertPosition({
              id: `pac-${pos.symbol}`,
              symbol: pos.symbol,
              side: pos.side,
              size: pos.size,
              entryPrice: pos.entryPrice,
              leverage,
              margin: pos.margin,
              marginHealth: 100,
              unrealizedPnl: 0,
              liquidationPrice: pos.liquidationPrice,
              openedAt: pos.openedAt,
            });
          }
        }
        // Remove positions that are no longer open on Pacifica
        const openSymbols = new Set(all.map(p => p.symbol));
        for (const storePos of store.positions) {
          if (!openSymbols.has(storePos.symbol)) {
            store.removePosition(storePos.id);
          }
        }

        if (all.length > 0 && store.gamePhase === 'idle') {
          store.setGamePhase('active');
        }
      } catch {
        // silently ignore — WS will fill in later
      }
    }

    seedPositions();

    function connect() {
      if (!active) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          method: 'subscribe',
          params: { source: 'account_positions', account: walletAddress },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.channel !== 'account_positions') return;

          const frames: PositionFrame[] = msg.data ?? [];
          // Apply all frames — creates positions for symbols not yet in store
          for (const frame of frames) {
            try {
              applyFrame(frame);
            } catch (e) {
              console.warn('[AccountPositions] frame apply error:', e);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!active) return;
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [walletAddress, signFn]);
}
