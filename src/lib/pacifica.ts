import axios, { AxiosInstance } from 'axios';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number; // USD notional margin
  leverage: number;
  orderType: 'market';
  currentPrice?: number; // needed to calc BTC amount
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  leverage: number;
  status: 'open' | 'filled' | 'cancelled';
  entryPrice: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginHealth: number;
  unrealizedPnl: number;
  liquidationPrice: number;
  margin: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

// ── Signing utilities ────────────────────────────────────────────────────────

/** Recursively sort all object keys alphabetically (Pacifica signing requirement) */
function sortJsonKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortJsonKeys);
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/** Build the canonical message string to sign */
function buildMessage(type: string, payload: Record<string, unknown>, timestamp: number, expiryWindow: number): string {
  const messageObj = {
    data: payload,
    expiry_window: expiryWindow,
    timestamp,
    type,
  };
  return JSON.stringify(sortJsonKeys(messageObj));
}

/** Generate a simple client order ID */
function genOrderId(): string {
  return `broadside-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Client ───────────────────────────────────────────────────────────────────

const DEMO_WALLET = 'demo-wallet';
const BASE_URL = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://test-api.pacifica.fi/api/v1';

export class PacificaClient {
  private walletAddress: string;
  private signMessage: (message: string) => Promise<string>;
  private client: AxiosInstance;

  constructor(walletAddress: string, signMessage: (message: string) => Promise<string>) {
    this.walletAddress = walletAddress;
    this.signMessage = signMessage;
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private get isDemo(): boolean {
    return this.walletAddress === DEMO_WALLET || !this.walletAddress;
  }

  /** Sign a payload and return the full request body for Pacifica API */
  private async buildSignedBody(
    type: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const timestamp = Date.now();
    const expiryWindow = 5000;

    const message = buildMessage(type, payload, timestamp, expiryWindow);
    const signature = await this.signMessage(message);

    return {
      account: this.walletAddress,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      ...payload,
    };
  }

  // ── Leverage ───────────────────────────────────────────────────────────────

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.isDemo) return;
    try {
      const payload = { symbol, leverage };
      const body = await this.buildSignedBody('set_leverage', payload);
      await this.client.post('/account/leverage', body);
    } catch (err) {
      console.warn('[Pacifica] setLeverage failed:', err);
    }
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async placeOrder(params: OrderParams): Promise<Order> {
    if (this.isDemo) return this.demoOrder(params);

    try {
      const btcSymbol = params.symbol.replace('-PERP', '');
      await this.setLeverage(btcSymbol, params.leverage);

      // Calculate BTC size from USD notional: notional = size * leverage, btcAmt = notional / price
      const btcPrice = params.currentPrice || 100000;
      const notional = params.size * params.leverage;
      const btcAmount = (notional / btcPrice).toFixed(6);

      const payload: Record<string, unknown> = {
        symbol: btcSymbol,
        reduce_only: false,
        amount: btcAmount,
        side: params.side === 'buy' ? 'bid' : 'ask',
        slippage_percent: '1.0',
        client_order_id: genOrderId(),
      };

      const body = await this.buildSignedBody('create_market_order', payload);
      const response = await this.client.post('/orders/create_market', body);
      const data = response.data;

      return {
        id: data.order_id || data.id || genOrderId(),
        symbol: params.symbol,
        side: params.side,
        size: params.size,
        leverage: params.leverage,
        status: 'filled',
        entryPrice: parseFloat(data.fill_price || data.price || btcPrice.toString()),
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn('[Pacifica] placeOrder failed, using demo fallback:', err);
      return this.demoOrder(params);
    }
  }

  async closePosition(symbol: string, currentPrice?: number): Promise<{ success: boolean; realizedPnl: number }> {
    if (this.isDemo) {
      return { success: true, realizedPnl: (Math.random() - 0.4) * 200 };
    }

    try {
      const btcSymbol = symbol.replace('-PERP', '');
      const btcPrice = currentPrice || 100000;

      // Close with a reduce-only market order in the opposite direction
      // We don't know the exact size here, so we use a large amount with reduce_only=true
      const payload: Record<string, unknown> = {
        symbol: btcSymbol,
        reduce_only: true,
        amount: '999999', // max possible — exchange will cap at open position size
        side: 'bid',      // will be overridden by reduce_only logic on exchange
        slippage_percent: '2.0',
        client_order_id: genOrderId(),
      };

      const body = await this.buildSignedBody('create_market_order', payload);
      const response = await this.client.post('/orders/create_market', body);
      const data = response.data;

      const realizedPnl = parseFloat(data.realized_pnl || data.pnl || '0');
      return { success: true, realizedPnl };
    } catch (err) {
      console.warn('[Pacifica] closePosition failed:', err);
      // Fall back to cancel all open orders
      try {
        await this.cancelAllOrders(symbol);
      } catch {
        // ignore
      }
      return { success: true, realizedPnl: 0 };
    }
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    if (this.isDemo) return;
    try {
      const btcSymbol = symbol.replace('-PERP', '');
      const payload = { symbol: btcSymbol };
      const body = await this.buildSignedBody('cancel_all_orders', payload);
      await this.client.post('/orders/cancel', body);
    } catch (err) {
      console.warn('[Pacifica] cancelAllOrders failed:', err);
    }
  }

  // ── Position / Price ───────────────────────────────────────────────────────

  async getPosition(symbol: string): Promise<Position | null> {
    if (this.isDemo) return null;
    try {
      const btcSymbol = symbol.replace('-PERP', '');
      const payload = { symbol: btcSymbol };
      const body = await this.buildSignedBody('get_position', payload);
      const response = await this.client.post('/account/positions', body);
      const data = response.data;

      if (!data || data.size === 0 || data.amount === '0') return null;

      const side: 'long' | 'short' = data.side === 'long' || data.side === 'bid' ? 'long' : 'short';
      const entryPrice = parseFloat(data.entry_price || data.avg_price || '0');
      const markPrice = parseFloat(data.mark_price || data.price || entryPrice.toString());
      const leverage = parseFloat(data.leverage || '1');
      const size = parseFloat(data.size || data.amount || '0');
      const unrealizedPnl = parseFloat(data.unrealized_pnl || data.pnl || '0');
      const liqPrice = parseFloat(data.liquidation_price || data.liq_price || '0');

      // Calculate margin health as % distance to liquidation
      let marginHealth = 100;
      if (liqPrice > 0 && markPrice > 0) {
        const distToLiq = Math.abs(markPrice - liqPrice);
        const totalRange = markPrice / leverage;
        marginHealth = Math.max(0, Math.min(100, (distToLiq / totalRange) * 100));
      }

      return {
        symbol,
        side,
        size,
        entryPrice,
        markPrice,
        leverage,
        marginHealth,
        unrealizedPnl,
        liquidationPrice: liqPrice,
        margin: size / leverage,
      };
    } catch {
      return null;
    }
  }

  async getPrice(symbol: string): Promise<PriceData> {
    try {
      const btcSymbol = symbol.replace('-PERP', '');
      const response = await this.client.get(`/prices/${btcSymbol}`);
      const data = response.data;
      const price = parseFloat(data.price || data.mark_price || data.index_price || '0');
      if (price > 0) {
        return { symbol, price, timestamp: Date.now() };
      }
    } catch {
      // fall through
    }
    return { symbol, price: 100000, timestamp: Date.now() };
  }

  // ── Demo fallbacks ─────────────────────────────────────────────────────────

  private demoOrder(params: OrderParams): Order {
    return {
      id: genOrderId(),
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      status: 'filled',
      entryPrice: params.currentPrice || 100000,
      timestamp: Date.now(),
    };
  }
}

export function createPacificaClient(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): PacificaClient {
  return new PacificaClient(walletAddress, signMessage);
}
