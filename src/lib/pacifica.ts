import axios, { AxiosInstance } from 'axios';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  leverage: number;
  orderType: 'market';
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
  marginHealth: number; // 0-100
  unrealizedPnl: number;
  liquidationPrice: number;
  margin: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

export class PacificaClient {
  private walletAddress: string;
  private signMessage: (message: string) => Promise<string>;
  private client: AxiosInstance;

  constructor(walletAddress: string, signMessage: (message: string) => Promise<string>) {
    this.walletAddress = walletAddress;
    this.signMessage = signMessage;
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.fi',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': walletAddress,
      },
    });
  }

  private async getAuthHeader(): Promise<{ 'X-Signature': string; 'X-Timestamp': string }> {
    const timestamp = Date.now().toString();
    const message = `pacifica-auth:${this.walletAddress}:${timestamp}`;
    try {
      const signature = await this.signMessage(message);
      return {
        'X-Signature': signature,
        'X-Timestamp': timestamp,
      };
    } catch {
      return {
        'X-Signature': 'demo-signature',
        'X-Timestamp': timestamp,
      };
    }
  }

  async placeOrder(params: OrderParams): Promise<Order> {
    try {
      const authHeaders = await this.getAuthHeader();
      const response = await this.client.post<Order>('/v1/orders', params, {
        headers: authHeaders,
      });
      return response.data;
    } catch {
      // Demo mode fallback
      const mockOrder: Order = {
        id: `order-${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        size: params.size,
        leverage: params.leverage,
        status: 'filled',
        entryPrice: await this.getPrice(params.symbol).then(p => p.price).catch(() => 65000 + Math.random() * 2000),
        timestamp: Date.now(),
      };
      return mockOrder;
    }
  }

  async closePosition(symbol: string): Promise<{ success: boolean; realizedPnl: number }> {
    try {
      const authHeaders = await this.getAuthHeader();
      const response = await this.client.delete<{ success: boolean; realizedPnl: number }>(
        `/v1/positions/${symbol}`,
        { headers: authHeaders }
      );
      return response.data;
    } catch {
      // Demo mode fallback
      return {
        success: true,
        realizedPnl: (Math.random() - 0.4) * 500,
      };
    }
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const authHeaders = await this.getAuthHeader();
      const response = await this.client.get<Position>(`/v1/positions/${symbol}`, {
        headers: authHeaders,
      });
      return response.data;
    } catch {
      // Demo mode: return null (no position)
      return null;
    }
  }

  async getPrice(symbol: string): Promise<PriceData> {
    try {
      const response = await this.client.get<PriceData>(`/v1/prices/${symbol}`);
      return response.data;
    } catch {
      // Demo mode: return simulated price
      return {
        symbol,
        price: 65000 + Math.random() * 2000 - 1000,
        timestamp: Date.now(),
      };
    }
  }
}

export function createPacificaClient(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): PacificaClient {
  return new PacificaClient(walletAddress, signMessage);
}
