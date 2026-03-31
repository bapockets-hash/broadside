import { useEffect } from 'react';
import { useGameStore, Timeframe } from '@/store/gameStore';

// Binance klines interval mapping
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '60m': '1h',
};

// Pacifica REST candles endpoint (try first, fallback to Binance)
const PACIFICA_BASE = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://test-api.pacifica.fi/api/v1';

async function fetchPacificaCandles(timeframe: Timeframe, limit: number) {
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `${PACIFICA_BASE}/candles?symbol=BTC&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Pacifica candles ${res.status}`);
  const data = await res.json();
  // Expected: [{ t: ms, c: "price" }, ...] or [[openTime, o, h, l, close], ...]
  const candles: [number, string][] = Array.isArray(data)
    ? data.map((k: Record<string, unknown> | unknown[]) => {
        if (Array.isArray(k)) return [k[0] as number, String(k[4])];
        return [(k.t ?? k.time ?? k.openTime) as number, String(k.c ?? k.close)];
      })
    : [];
  if (!candles.length) throw new Error('empty Pacifica candles');
  return {
    prices: candles.map(k => parseFloat(k[1])),
    timestamps: candles.map(k => k[0]),
  };
}

async function fetchBinanceCandles(timeframe: Timeframe, limit: number) {
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  // [[openTime, open, high, low, close, baseVol, closeTime, quoteVol, ...], ...]
  const data: [number, string, string, string, string, string, number, string, ...unknown[]][] = await res.json();
  return {
    prices: data.map(k => parseFloat(k[4])),    // close price
    timestamps: data.map(k => k[0]),             // open time in ms
    volumes: data.map(k => parseFloat(k[7])),    // quote asset volume (USDT)
  };
}

export function useHistoricalPrices() {
  const timeframe = useGameStore(s => s.timeframe);
  const setHistoricalData = useGameStore(s => s.setHistoricalData);
  const setVolumeHistory = useGameStore(s => s.setVolumeHistory);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Try Pacifica first (no volume data), fall back to Binance
        let prices: number[];
        let timestamps: number[];
        let volumes: number[] | undefined;
        try {
          const r = await fetchPacificaCandles(timeframe, 200);
          prices = r.prices;
          timestamps = r.timestamps;
        } catch {
          const r = await fetchBinanceCandles(timeframe, 200);
          prices = r.prices;
          timestamps = r.timestamps;
          volumes = r.volumes;
        }
        if (!cancelled) {
          setHistoricalData(prices, timestamps);
          if (volumes) setVolumeHistory(volumes);
        }
      } catch (err) {
        console.warn('[HistoricalPrices] fetch failed:', err);
      }
    }

    load();

    // Refresh every 60s so volume stays current with live candle data
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [timeframe, setHistoricalData, setVolumeHistory]);
}
