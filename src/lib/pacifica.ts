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
  liquidationPrice: number | null; // null = not provided by API
  margin: number | null;           // initial margin in USD
  marginHealth: number | null;     // 0-100 if provided
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

export interface ClosePositionParams {
  side: 'long' | 'short';
  margin: number;
  leverage: number;
  entryPrice: number;
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

/** Generate a UUID v4 client order ID */
function genOrderId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Client ───────────────────────────────────────────────────────────────────

const DEMO_WALLET = 'demo-wallet';
const BASE_URL = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.fi/api/v1';
const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || '';

export interface MarketInfo {
  symbol: string;
  lotSize: number;
  maxLeverage: number;
  minOrderSize: number;
  maxOrderSize: number;
}

// Module-level cache shared across all client instances — fetched once per session
let marketInfoCache: Record<string, MarketInfo> | null = null;
let marketInfoFetch: Promise<Record<string, MarketInfo>> | null = null;

async function fetchMarketInfo(): Promise<Record<string, MarketInfo>> {
  if (marketInfoCache) return marketInfoCache;
  if (marketInfoFetch) return marketInfoFetch;

  marketInfoFetch = axios.get(`${BASE_URL}/info`).then(res => {
    const entries: Record<string, MarketInfo> = {};
    for (const item of res.data?.data ?? []) {
      entries[item.symbol] = {
        symbol: item.symbol,
        lotSize: parseFloat(item.lot_size),
        maxLeverage: parseInt(item.max_leverage),
        minOrderSize: parseFloat(item.min_order_size),
        maxOrderSize: parseFloat(item.max_order_size),
      };
    }
    marketInfoCache = entries;
    return entries;
  }).catch(() => {
    marketInfoFetch = null; // allow retry on next call
    return {} as Record<string, MarketInfo>;
  });

  return marketInfoFetch;
}

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

  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    if (this.isDemo) return true;
    try {
      // Type must be "update_leverage" per Pacifica docs
      // builder_code is not a documented field for this endpoint — omit it
      const payload = { symbol, leverage: Math.round(leverage) };
      const body = await this.buildSignedBody('update_leverage', payload);
      await this.client.post('/account/leverage', body);
      return true;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        console.warn('[Pacifica] setLeverage error:', JSON.stringify(err.response.data));
      }
      return false;
    }
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async placeOrder(params: OrderParams): Promise<Order> {
    if (this.isDemo) return this.demoOrder(params);

    try {
      const btcSymbol = params.symbol.replace('-PERP', '');

      // Calculate base token amount: notional / price, rounded to lot size
      const btcPrice = params.currentPrice || 100000;
      const notional = params.size * params.leverage;
      const markets = await fetchMarketInfo();
      const lotSize = markets[btcSymbol]?.lotSize ?? 0.01;
      const decimals = Math.max(0, Math.round(-Math.log10(lotSize)));
      const btcAmount = (Math.floor(notional / btcPrice / lotSize) * lotSize).toFixed(decimals);

      // Set leverage first — non-blocking on failure but must complete before signing order
      await this.setLeverage(btcSymbol, params.leverage);

      const payload: Record<string, unknown> = {
        symbol: btcSymbol,
        reduce_only: false,
        amount: btcAmount,
        side: params.side === 'buy' ? 'bid' : 'ask',
        slippage_percent: '1.0',
        client_order_id: genOrderId(),
        ...(BUILDER_CODE ? { builder_code: BUILDER_CODE } : {}),
      };

      const body = await this.buildSignedBody('create_market_order', payload);
      const response = await this.client.post('/orders/create_market', body);
      const data = response.data;

      // Pacifica only returns { order_id } — position details come from getPosition
      return {
        id: data.order_id || data.id || genOrderId(),
        symbol: params.symbol,
        side: params.side,
        size: params.size,
        leverage: params.leverage,
        status: 'filled',
        entryPrice: btcPrice,
        liquidationPrice: null,
        margin: null,
        marginHealth: null,
        timestamp: Date.now(),
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        console.error('[Pacifica] placeOrder error body:', JSON.stringify(err.response.data));
        const msg = err.response.data?.message || err.response.data?.error || JSON.stringify(err.response.data);
        throw new Error(`${err.response.status}: ${msg}`);
      }
      throw err;
    }
  }

  async closePosition(symbol: string, position: ClosePositionParams, currentPrice?: number): Promise<{ success: boolean; realizedPnl: number }> {
    if (this.isDemo) {
      return { success: true, realizedPnl: (Math.random() - 0.4) * 200 };
    }

    try {
      const btcSymbol = symbol.replace('-PERP', '');
      const markets = await fetchMarketInfo();
      const lotSize = markets[btcSymbol]?.lotSize ?? 0.01;
      const decimals = Math.max(0, Math.round(-Math.log10(lotSize)));

      // Calculate actual base token amount from position: notional / entryPrice
      const notional = position.margin * position.leverage;
      const tokenAmount = (Math.floor(notional / position.entryPrice / lotSize) * lotSize).toFixed(decimals);

      // Close side must be opposite to open side
      const closeSide = position.side === 'long' ? 'ask' : 'bid';

      const payload: Record<string, unknown> = {
        symbol: btcSymbol,
        reduce_only: true,
        amount: tokenAmount,
        side: closeSide,
        slippage_percent: '2.0',
        client_order_id: genOrderId(),
        ...(BUILDER_CODE ? { builder_code: BUILDER_CODE } : {}),
      };

      const body = await this.buildSignedBody('create_market_order', payload);
      console.log('[Pacifica] closePosition body:', JSON.stringify({ ...body, signature: (body.signature as string)?.slice(0, 16) + '...' }));
      const response = await this.client.post('/orders/create_market', body);
      const data = response.data;

      const realizedPnl = parseFloat(data.realized_pnl || data.pnl || '0');
      return { success: true, realizedPnl };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        console.error('[Pacifica] closePosition error body:', JSON.stringify(err.response.data));
        const msg = err.response.data?.message || err.response.data?.error || JSON.stringify(err.response.data);
        throw new Error(`${err.response.status}: ${msg}`);
      }
      throw err;
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

  // ── Builder code approval ──────────────────────────────────────────────────

  /** Returns true if this wallet has already approved the given builder code */
  async checkBuilderApproval(builderCode: string): Promise<boolean> {
    if (this.isDemo) return false;
    try {
      const res = await this.client.get(
        `/account/builder_codes/approvals?account=${this.walletAddress}`
      );
      const approvals: { builder_code: string }[] = res.data ?? [];
      return approvals.some(a => a.builder_code === builderCode);
    } catch {
      return false;
    }
  }

  /** Sign and submit a builder code approval */
  async approveBuilderCode(builderCode: string, maxFeeRate = '0.001'): Promise<void> {
    if (this.isDemo) return;
    const payload = { builder_code: builderCode, max_fee_rate: maxFeeRate };
    const timestamp = Date.now();
    const expiryWindow = 5000;
    const message = buildMessage('approve_builder_code', payload, timestamp, expiryWindow);
    const signature = await this.signMessage(message);
    const body = {
      account: this.walletAddress,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      ...payload,
    };
    await this.client.post('/account/builder_codes/approve', body);
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
    const entryPrice = params.currentPrice || 100000;
    const liqMove = entryPrice / params.leverage;
    return {
      id: genOrderId(),
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      status: 'filled',
      entryPrice,
      liquidationPrice: params.side === 'buy'
        ? entryPrice - liqMove
        : entryPrice + liqMove,
      margin: params.size,
      marginHealth: 100,
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

export { fetchMarketInfo };
