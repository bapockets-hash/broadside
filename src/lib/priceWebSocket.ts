const PACIFICA_WS_URL = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://test-ws.pacifica.fi/ws';

export interface MarketStats {
  funding: number;      // funding rate as decimal (e.g. 0.000015)
  openInterest: number; // in base token (BTC)
  volume24h: number;    // in USD
}

export interface MarketEntry {
  symbol: string;
  price: number;
  funding: number;
  openInterest: number;
  volume24h: number;
}

export class PriceWebSocket {
  private symbol: string;
  private onPrice: (price: number) => void;
  private onMarketStats?: (stats: MarketStats) => void;
  private onAllMarketData?: (entries: MarketEntry[]) => void;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private lastPrice = 100000;
  private source: 'pacifica' | 'binance' | 'simulation' = 'pacifica';

  constructor(
    symbol: string,
    onPrice: (price: number) => void,
    onMarketStats?: (stats: MarketStats) => void,
    onAllMarketData?: (entries: MarketEntry[]) => void,
  ) {
    this.symbol = symbol;
    this.onPrice = onPrice;
    this.onMarketStats = onMarketStats;
    this.onAllMarketData = onAllMarketData;
  }

  connect(): void {
    if (this.isConnected) return;
    if (typeof window === 'undefined') return;
    this.tryPacificaConnection();
  }

  private tryPacificaConnection(): void {
    try {
      this.ws = new WebSocket(PACIFICA_WS_URL);

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          this.tryBinanceConnection();
        }
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.source = 'pacifica';
        this.ws?.send(JSON.stringify({
          method: 'subscribe',
          params: { source: 'prices' },
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlePacificaMessage(data);
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.isConnected) {
          this.tryBinanceConnection();
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.source === 'pacifica') {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.tryBinanceConnection();
    }
  }

  /** Handle Pacifica WebSocket messages.
   *  Actual format: { channel: "prices", data: [{ symbol, mark, funding, open_interest, volume_24h, ... }] }
   */
  private handlePacificaMessage(data: Record<string, unknown>): void {
    // Primary format: { channel: "prices", data: [...] }
    if (data.channel === 'prices' && Array.isArray(data.data)) {
      const baseSymbol = this.symbol.replace('-PERP', '').replace('USDT', '').toUpperCase();
      const entry = (data.data as Record<string, string>[]).find(x => x.symbol === baseSymbol);
      if (entry) {
        const price = parseFloat(entry.mark || entry.oracle || entry.mid);
        if (!isNaN(price) && price > 0) {
          this.lastPrice = price;
          this.onPrice(price);
        }
        if (this.onMarketStats) {
          const funding = parseFloat(entry.funding);
          const openInterest = parseFloat(entry.open_interest);
          const volume24h = parseFloat(entry.volume_24h);
          if (!isNaN(funding) && !isNaN(openInterest) && !isNaN(volume24h)) {
            this.onMarketStats({ funding, openInterest, volume24h });
          }
        }
      }
      if (this.onAllMarketData) {
        const allEntries: MarketEntry[] = (data.data as Record<string, string>[])
          .map(x => ({
            symbol: x.symbol,
            price: parseFloat(x.mark || x.oracle || x.mid),
            funding: parseFloat(x.funding) || 0,
            openInterest: parseFloat(x.open_interest) || 0,
            volume24h: parseFloat(x.volume_24h) || 0,
          }))
          .filter(e => !isNaN(e.price) && e.price > 0);
        this.onAllMarketData(allEntries);
      }
      return;
    }

    // Fallback formats (legacy/alternative)
    const price = this.extractPacificaPrice(data);
    if (price !== null) {
      this.lastPrice = price;
      this.onPrice(price);
    }
  }

  /** Parse price from legacy Pacifica WebSocket message formats */
  private extractPacificaPrice(data: Record<string, unknown>): number | null {
    // Format: { type: "prices", data: { BTC: "104000.50", ... } }
    if (data.type === 'prices' && data.data && typeof data.data === 'object') {
      const prices = data.data as Record<string, string>;
      const btcPrice = prices['BTC'] || prices['BTC-PERP'] || prices['BTCUSDT'];
      if (btcPrice) {
        const p = parseFloat(btcPrice);
        if (!isNaN(p) && p > 0) return p;
      }
    }

    // Format: { symbol: "BTC", price: "104000.50" }
    if (data.symbol && (data.price || data.mark_price || data.index_price)) {
      const sym = String(data.symbol).toUpperCase();
      if (sym === 'BTC' || sym === 'BTC-PERP' || sym === 'BTCUSDT') {
        const p = parseFloat(String(data.price || data.mark_price || data.index_price));
        if (!isNaN(p) && p > 0) return p;
      }
    }

    // Format: { data: { price: "104000.50", symbol: "BTC" } }
    if (data.data && typeof data.data === 'object') {
      const inner = data.data as Record<string, unknown>;
      if (inner.price) {
        const p = parseFloat(String(inner.price));
        if (!isNaN(p) && p > 0) return p;
      }
    }

    // Generic last-price field
    if (data.lastPrice || data.last_price) {
      const p = parseFloat(String(data.lastPrice || data.last_price));
      if (!isNaN(p) && p > 0) return p;
    }

    return null;
  }

  private tryBinanceConnection(): void {
    try {
      const binanceWs = 'wss://stream.binance.com:9443/ws/btcusdt@miniTicker';
      this.ws = new WebSocket(binanceWs);

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          this.startSimulation();
        }
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.source = 'binance';
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.c) {
            const price = parseFloat(data.c);
            if (!isNaN(price) && price > 0) {
              this.lastPrice = price;
              this.onPrice(price);
            }
          }
        } catch {
          // ignore
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.isConnected) {
          this.startSimulation();
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };
    } catch {
      this.startSimulation();
    }
  }

  private startSimulation(): void {
    this.isConnected = true;
    this.source = 'simulation';
    this.simulationInterval = setInterval(() => {
      const drift = (Math.random() - 0.49) * 0.0005;
      const volatility = (Math.random() - 0.5) * 0.004;
      this.lastPrice = Math.max(50000, Math.min(200000, this.lastPrice * (1 + drift + volatility)));
      this.onPrice(Math.round(this.lastPrice * 100) / 100);
    }, 1000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected) {
        this.connect();
      }
    }, 5000);
  }

  disconnect(): void {
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export function createPriceWebSocket(
  symbol: string,
  onPrice: (price: number) => void,
  onMarketStats?: (stats: MarketStats) => void,
  onAllMarketData?: (entries: MarketEntry[]) => void,
): PriceWebSocket {
  return new PriceWebSocket(symbol, onPrice, onMarketStats, onAllMarketData);
}
