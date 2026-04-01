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
const PACIFICA_BASE = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.fi/api/v1';

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  AVAX: 'AVAXUSDT', XRP: 'XRPUSDT', DOGE: 'DOGEUSDT', ADA: 'ADAUSDT',
  LINK: 'LINKUSDT', SUI: 'SUIUSDT', TON: 'TONUSDT', NEAR: 'NEARUSDT',
  ICP: 'ICPUSDT', TAO: 'TAOUSDT', HYPE: 'HYPEUSDT',
  kPEPE: '1000PEPEUSDT', kBONK: '1000BONKUSDT',
  UNI: 'UNIUSDT', AAVE: 'AAVEUSDT', CRV: 'CRVUSDT', LDO: 'LDOUSDT',
  ARB: 'ARBUSDT', JUP: 'JUPUSDT', TRUMP: 'TRUMPUSDT', WIF: 'WIFUSDT',
  PENGU: 'PENGUUSDT', LTC: 'LTCUSDT', BCH: 'BCHUSDT',
  XMR: 'XMRUSDT', ZEC: 'ZECUSDT', ENA: 'ENAUSDT', STRK: 'STRKUSDT',
  VIRTUAL: 'VIRTUALUSDT', ZK: 'ZKUSDT', ZRO: 'ZROUSDT',
  WLD: 'WLDUSDT', PAXG: 'PAXGUSDT', OM: 'OMUSDT',
};

async function fetchPacificaCandles(timeframe: Timeframe, limit: number, symbol: string = 'BTC') {
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `${PACIFICA_BASE}/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Pacifica candles ${res.status}`);
  const data = await res.json();

  // Pacifica candles can be array-of-arrays [openTime,o,h,l,close,vol,...] or
  // array-of-objects {t,o,h,l,c,v} — extract close and volume from both shapes.
  type RawCandle = Record<string, unknown> | unknown[];
  const rows: { t: number; c: number; v: number }[] = Array.isArray(data)
    ? data.map((k: RawCandle) => {
        if (Array.isArray(k)) {
          return {
            t: k[0] as number,
            c: parseFloat(String(k[4])),
            v: parseFloat(String(k[5] ?? k[7] ?? 0)),
          };
        }
        const obj = k as Record<string, unknown>;
        return {
          t: (obj.t ?? obj.time ?? obj.openTime) as number,
          c: parseFloat(String(obj.c ?? obj.close)),
          v: parseFloat(String(obj.v ?? obj.vol ?? obj.volume ?? obj.quoteVol ?? 0)),
        };
      })
    : [];

  if (!rows.length) throw new Error('empty Pacifica candles');
  return {
    prices:     rows.map(r => r.c),
    timestamps: rows.map(r => r.t),
    volumes:    rows.map(r => (isNaN(r.v) ? 0 : r.v)),
  };
}

async function fetchBinanceCandles(timeframe: Timeframe, limit: number, pair: string = 'BTCUSDT') {
  const interval = BINANCE_INTERVAL[timeframe];
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
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
  const selectedSymbol = useGameStore(s => s.selectedSymbol);
  const setHistoricalData = useGameStore(s => s.setHistoricalData);
  const setVolumeHistory = useGameStore(s => s.setVolumeHistory);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const binancePair = BINANCE_SYMBOL_MAP[selectedSymbol];

        let prices: number[];
        let timestamps: number[];
        let volumes: number[] | undefined;

        try {
          const r = await fetchPacificaCandles(timeframe, 200, selectedSymbol);
          prices = r.prices;
          timestamps = r.timestamps;
          volumes = r.volumes;
          // If Pacifica returned all-zero volumes (field absent), try Binance as backup
          const hasVol = volumes.some(v => v > 0);
          if (!hasVol && binancePair) {
            try {
              const vr = await fetchBinanceCandles(timeframe, 200, binancePair);
              volumes = vr.volumes;
            } catch { /* keep zero volumes, terrain will be flat */ }
          }
        } catch {
          if (!binancePair) return; // no data source for this symbol
          const r = await fetchBinanceCandles(timeframe, 200, binancePair);
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
  }, [timeframe, selectedSymbol, setHistoricalData, setVolumeHistory]);
}
