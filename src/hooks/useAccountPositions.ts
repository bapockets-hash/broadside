'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';

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
  const existingPos = store.position;
  if (!existingPos) return false;

  const entryPrice = parseFloat(frame.p);
  const tokenAmount = parseFloat(frame.a);
  const side = frame.d === 'bid' ? 'long' : 'short';

  let liquidationPrice = existingPos.liquidationPrice;
  if (frame.l != null && frame.l !== '') {
    const liq = parseFloat(frame.l);
    // Cross-margin longs produce negative l values (liq would require price < 0 —
    // effectively unliquidatable given account equity). Only accept values that are
    // positive and directionally valid: long liq below entry, short liq above entry.
    const isValid = liq > 0 && (side === 'long' ? liq < entryPrice : liq > entryPrice);
    if (isValid) liquidationPrice = liq;
  }

  const currentPrice = store.currentPrice;
  const unrealizedPnl = Math.round(
    (side === 'long'
      ? (currentPrice - entryPrice) * tokenAmount
      : (entryPrice - currentPrice) * tokenAmount
    ) * 100
  ) / 100;

  store.setPosition({ ...existingPos, entryPrice, liquidationPrice, unrealizedPnl });
  return true;
}

/**
 * Subscribes to Pacifica's account_positions WebSocket stream.
 * Buffers frames that arrive before setPosition is called (WS/HTTP race),
 * then applies them the moment the position exists in the store.
 */
export function useAccountPositions() {
  const { walletAddress } = usePacificaSigner();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Buffer: latest frame per base symbol, held until position is set in store
  const pendingRef = useRef<Record<string, PositionFrame>>({});

  // When position transitions from null → set, apply any buffered frame
  useEffect(() => {
    return useGameStore.subscribe((state, prev) => {
      if (!prev.position && state.position) {
        const frame = pendingRef.current[state.selectedSymbol];
        if (frame) {
          applyFrame(frame);
          delete pendingRef.current[state.selectedSymbol];
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!walletAddress || typeof window === 'undefined') return;

    let active = true;

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

          const data: PositionFrame[] = msg.data ?? [];
          const store = useGameStore.getState();
          const currentSymbol = store.selectedSymbol;

          const frame = data.find(f =>
            f.s === currentSymbol ||
            f.s === currentSymbol + '-PERP' ||
            f.s.replace('-PERP', '') === currentSymbol
          );

          if (!frame) return;

          console.log('[AccountPositions] frame:', JSON.stringify(frame));

          // Try to apply immediately; if position not set yet, buffer it
          if (!applyFrame(frame)) {
            pendingRef.current[currentSymbol] = frame;
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
  }, [walletAddress]);
}
