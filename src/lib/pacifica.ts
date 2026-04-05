import axios, { AxiosInstance } from 'axios';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number; // USD notional margin
  leverage: number;
  orderType: 'market';
  currentPrice?: number; // needed to calc BTC amount
  marginMode?: 'isolated' | 'cross';
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
  openedAt: number;
}

export interface ClosePositionParams {
  side: 'long' | 'short';
  size: number;      // token amount (e.g. 0.0244 ETH)
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
const BUILDER_CODE = (process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || '').trim();

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

      const isIsolated = params.marginMode === 'isolated';
      const payload: Record<string, unknown> = {
        symbol: btcSymbol,
        reduce_only: false,
        amount: btcAmount,
        side: params.side === 'buy' ? 'bid' : 'ask',
        slippage_percent: '1.0',
        client_order_id: genOrderId(),
        isolated: isIsolated,
        ...(isIsolated ? { margin: params.size.toFixed(2) } : {}),
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

      // Use the actual token size from the position (e.g. 0.0244 ETH), rounded to lot size
      const tokenAmount = (Math.floor(position.size / lotSize) * lotSize).toFixed(decimals);

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
      const response = await this.client.get(`/positions?account=${this.walletAddress}`);
      const list: Record<string, unknown>[] = response.data?.data ?? [];
      const data = list.find(p =>
        String(p.symbol) === btcSymbol ||
        String(p.symbol) === btcSymbol + '-PERP' ||
        String(p.symbol).replace('-PERP', '') === btcSymbol
      );

      if (!data || data.amount === '0' || !data.amount) return null;

      const side: 'long' | 'short' = data.side === 'long' || data.side === 'bid' ? 'long' : 'short';
      const entryPrice = parseFloat(String(data.entry_price || '0'));
      const size = parseFloat(String(data.amount || '0'));
      // margin is USD isolated margin; 0 means cross-margin (don't use as fallback)
      const margin = parseFloat(String(data.margin || '0'));
      const liqPrice = parseFloat(String(data.liquidation_price || '0'));
      const openedAt = typeof data.created_at === 'number' ? data.created_at : Date.now();

      return {
        symbol,
        side,
        size,
        entryPrice,
        markPrice: entryPrice,
        leverage: 1,        // not derivable here; store keeps user's selected leverage
        marginHealth: 100,
        unrealizedPnl: 0,
        liquidationPrice: liqPrice,
        margin,             // 0 for cross-margin — syncPosition handles this
        openedAt,
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        console.warn('[Pacifica] getPosition error:', err.response.status, JSON.stringify(err.response.data));
      }
      return null;
    }
  }

  async getAllPositions(): Promise<Position[]> {
    if (this.isDemo) return [];
    try {
      const response = await this.client.get(`/positions?account=${this.walletAddress}`);
      const list: Record<string, unknown>[] = response.data?.data ?? [];
      const results: Position[] = [];
      for (const data of list) {
        if (!data.amount || data.amount === '0') continue;
        const symbol = String(data.symbol || '').replace('-PERP', '');
        const side: 'long' | 'short' = data.side === 'long' || data.side === 'bid' ? 'long' : 'short';
        const entryPrice = parseFloat(String(data.entry_price || '0'));
        const size = parseFloat(String(data.amount || '0'));
        const margin = parseFloat(String(data.margin || '0'));
        const liqPrice = parseFloat(String(data.liquidation_price || '0'));
        const openedAt = typeof data.created_at === 'number' ? data.created_at : Date.now();
        if (!symbol || !entryPrice) continue;
        results.push({
          symbol,
          side,
          size,
          entryPrice,
          markPrice: entryPrice,
          leverage: margin > 0 ? Math.round((size * entryPrice) / margin) : 1,
          marginHealth: 100,
          unrealizedPnl: 0,
          liquidationPrice: liqPrice,
          margin,
          openedAt,
        });
      }
      return results;
    } catch {
      return [];
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

  async getAccountSettings(): Promise<Record<string, { leverage: number; isolated: boolean }>> {
    if (this.isDemo) return {};
    try {
      const res = await this.client.get(`/account/settings?account=${this.walletAddress}`);
      const settings: { symbol: string; leverage: number; isolated: boolean }[] =
        res.data?.data?.margin_settings ?? [];
      const map: Record<string, { leverage: number; isolated: boolean }> = {};
      for (const s of settings) {
        map[s.symbol.replace('-PERP', '')] = { leverage: s.leverage, isolated: s.isolated };
      }
      return map;
    } catch {
      return {};
    }
  }

  async getBalance(): Promise<number | null> {
    if (this.isDemo) return null;
    try {
      const res = await this.client.get(`/account?account=${this.walletAddress}`);
      const data = res.data?.data;
      const raw = data?.available_to_spend ?? data?.balance ?? null;
      if (raw == null) return null;
      return parseFloat(raw);
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
