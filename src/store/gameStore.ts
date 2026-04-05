import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface MarketEntry {
  symbol: string;
  price: number;
  funding: number;
  openInterest: number;
  volume24h: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  leverage: number;
  margin: number;          // initial margin in USD
  marginHealth: number;    // 0-100, 100=healthy, 0=liquidated
  unrealizedPnl: number;
  liquidationPrice: number;
  openedAt: number;        // ms timestamp when position was opened (from Pacifica created_at)
}

export type GamePhase = 'idle' | 'aiming' | 'firing' | 'active' | 'retreating' | 'sunk';

export interface CombatLogEntry {
  message: string;
  timestamp: number;
  type: 'attack' | 'defend' | 'damage' | 'info' | 'victory' | 'defeat';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  type: 'profit' | 'survive_waves' | 'trades' | 'leverage';
  reward: number;
  completed: boolean;
}

export interface SessionStats {
  totalTrades: number;
  wins: number;
  bestPnl: number;
  totalPnl: number;
}

const ALL_MISSIONS: Mission[] = [
  { id: 'first_fire', title: 'OPEN FIRE', description: 'Place your first trade', target: 1, type: 'trades', reward: 50, completed: false },
  { id: 'survive_10', title: 'SEA LEGS', description: 'Survive 10 price waves with open position', target: 10, type: 'survive_waves', reward: 100, completed: false },
  { id: 'profit_50', title: 'PRIZE MONEY', description: 'Close a trade with +$50 profit', target: 50, type: 'profit', reward: 150, completed: false },
  { id: 'max_leverage', title: 'RECKLESS', description: 'Fire at 10x leverage', target: 1, type: 'leverage', reward: 75, completed: false },
  { id: 'profit_200', title: 'PLUNDER', description: 'Close a trade with +$200 profit', target: 200, type: 'profit', reward: 300, completed: false },
];

const RANK_THRESHOLDS: { xp: number; rank: string }[] = [
  { xp: 30000, rank: 'Admiral of the Fleet' },
  { xp: 15000, rank: 'Admiral' },
  { xp: 8000, rank: 'Vice Admiral' },
  { xp: 4000, rank: 'Rear Admiral' },
  { xp: 2000, rank: 'Commodore' },
  { xp: 1000, rank: 'Captain' },
  { xp: 600, rank: 'Commander' },
  { xp: 300, rank: 'Lieutenant' },
  { xp: 100, rank: 'Ensign' },
  { xp: 0, rank: 'Recruit' },
];

function calcRank(xp: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (xp >= threshold.xp) return threshold.rank;
  }
  return 'Recruit';
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '60m';

// How many raw buffer ticks each timeframe looks back (ticks arrive ~every 1.5s)
const TIMEFRAME_TICKS: Record<Timeframe, number> = {
  '1m':  40,
  '5m':  200,
  '15m': 400,
  '30m': 600,
  '60m': 900,
};
const BUFFER_MAX = 900;
const DISPLAY_POINTS = 30; // points shown on chart

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// Build a default timestamp buffer spaced by the given candle interval (ms)
function defaultTimestamps(n: number, intervalMs: number): number[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => now - (n - 1 - i) * intervalMs);
}

export interface GameState {
  // Position state
  positions: Position[];

  // Game state
  currentPrice: number;
  priceHistory: number[];      // display-ready prices (30 points) for Phaser chart
  priceTimestamps: number[];   // display-ready timestamps (ms) matching priceHistory
  priceBuffer: number[];       // full rolling buffer of raw prices
  timestampBuffer: number[];   // full rolling buffer of corresponding timestamps
  volumeHistory: number[];     // display-ready volumes (30 points) matching priceHistory
  timeframe: Timeframe;
  leverage: number; // selected leverage 1-10
  marginMode: 'isolated' | 'cross';
  selectedSide: 'long' | 'short' | null;
  tradeSize: number; // in USD
  isLoading: boolean;
  gamePhase: GamePhase;
  combatLog: CombatLogEntry[];

  // Meta game
  combo: number;
  comboTimer: number | null;
  xp: number;
  rank: string;
  missions: Mission[];
  missionProgress: Record<string, number>;
  sessionStats: SessionStats;
  lightMode: boolean;
  marketStats: { funding: number; openInterest: number; volume24h: number } | null;
  selectedSymbol: string;
  allMarketPrices: Record<string, MarketEntry>;
  symbolLeverages: Record<string, number>; // persisted leverage per symbol

  // Actions
  setCurrentPrice: (price: number) => void;
  addPriceHistory: (price: number) => void;
  setHistoricalData: (prices: number[], timestamps: number[]) => void;
  setVolumeHistory: (volumes: number[]) => void;
  setTimeframe: (tf: Timeframe) => void;
  upsertPosition: (pos: Position) => void;
  setLeverage: (leverage: number) => void;
  setMarginMode: (mode: 'isolated' | 'cross') => void;
  setSelectedSide: (side: 'long' | 'short' | null) => void;
  setTradeSize: (size: number) => void;
  setLoading: (loading: boolean) => void;
  setGamePhase: (phase: GamePhase) => void;
  removePosition: (id: string) => void;
  addCombatLog: (message: string, type: CombatLogEntry['type']) => void;

  // Meta game actions
  incrementCombo: () => void;
  resetCombo: () => void;
  addXP: (amount: number) => void;
  completeMission: (id: string) => void;
  updateMissionProgress: (type: string, value: number) => void;
  updateSessionStats: (pnl: number, isWin: boolean) => void;
  toggleLightMode: () => void;
  setMarketStats: (stats: { funding: number; openInterest: number; volume24h: number }) => void;
  setSelectedSymbol: (symbol: string) => void;
  setAllMarketPrices: (entries: MarketEntry[]) => void;
  recordSymbolLeverage: (symbol: string, leverage: number) => void;
}

export const useGameStore = create<GameState>()(persist((set, get) => ({
  positions: [],
  currentPrice: 65000,
  priceHistory: Array(DISPLAY_POINTS).fill(65000),
  priceTimestamps: defaultTimestamps(DISPLAY_POINTS, 60_000),
  priceBuffer: Array(DISPLAY_POINTS).fill(65000),
  timestampBuffer: defaultTimestamps(DISPLAY_POINTS, 60_000),
  volumeHistory: Array(DISPLAY_POINTS).fill(0),
  timeframe: '1m',
  leverage: 1,
  marginMode: 'cross',
  selectedSide: null,
  tradeSize: 100,
  isLoading: false,
  gamePhase: 'idle',
  combatLog: [
    { message: 'SYSTEM ONLINE. AWAITING ORDERS.', timestamp: Date.now(), type: 'info' },
  ],

  // Meta game initial state
  combo: 0,
  comboTimer: null,
  xp: 0,
  rank: 'Recruit',
  missions: ALL_MISSIONS.slice(0, 3),
  missionProgress: {},
  sessionStats: {
    totalTrades: 0,
    wins: 0,
    bestPnl: 0,
    totalPnl: 0,
  },
  lightMode: false,
  marketStats: null,
  selectedSymbol: 'BTC',
  allMarketPrices: {},
  symbolLeverages: {},

  setCurrentPrice: (price) =>
    set(() => {
      return { currentPrice: price };
    }),

  addPriceHistory: (price) =>
    set((state) => {
      const now = Date.now();
      const newBuffer = [...state.priceBuffer, price].slice(-BUFFER_MAX);
      const newTsBuffer = [...state.timestampBuffer, now].slice(-BUFFER_MAX);
      const ticks = TIMEFRAME_TICKS[state.timeframe];
      const window = newBuffer.slice(-ticks);
      const tsWindow = newTsBuffer.slice(-ticks);
      return {
        priceBuffer: newBuffer,
        timestampBuffer: newTsBuffer,
        priceHistory: downsample(window, DISPLAY_POINTS),
        priceTimestamps: downsample(tsWindow, DISPLAY_POINTS),
      };
    }),

  setHistoricalData: (prices, timestamps) =>
    set(() => {
      // prices[] are already candles at the selected timeframe interval.
      // Store them as-is; show the last DISPLAY_POINTS directly — no tick-based
      // windowing needed because the data is already at the right granularity.
      const priceBuffer = prices.slice(-BUFFER_MAX);
      const timestampBuffer = timestamps.slice(-BUFFER_MAX);
      return {
        priceBuffer,
        timestampBuffer,
        priceHistory: priceBuffer.slice(-DISPLAY_POINTS),
        priceTimestamps: timestampBuffer.slice(-DISPLAY_POINTS),
        currentPrice: prices[prices.length - 1] ?? 0,
      };
    }),

  setTimeframe: (tf) =>
    set(() => ({
      // Just record the new timeframe; useHistoricalPrices will refetch candles
      // at the correct interval and call setHistoricalData to update the chart.
      timeframe: tf,
    })),

  setVolumeHistory: (volumes) =>
    set(() => {
      const buf = volumes.slice(-BUFFER_MAX);
      return { volumeHistory: buf.slice(-DISPLAY_POINTS) };
    }),

  upsertPosition: (pos) => set((state) => {
    const exists = state.positions.some(p => p.id === pos.id);
    const leverageUpdate = pos.leverage > 1
      ? { symbolLeverages: { ...state.symbolLeverages, [pos.symbol]: pos.leverage } }
      : {};
    return {
      positions: exists
        ? state.positions.map(p => p.id === pos.id ? pos : p)
        : [...state.positions, pos],
      ...leverageUpdate,
    };
  }),

  setLeverage: (leverage) => set({ leverage }),
  setMarginMode: (marginMode) => set({ marginMode }),

  setSelectedSide: (side) => set({ selectedSide: side }),

  setTradeSize: (size) => set({ tradeSize: size }),

  setLoading: (loading) => set({ isLoading: loading }),

  setGamePhase: (phase) => set({ gamePhase: phase }),

  removePosition: (id) => set((state) => {
    const remaining = state.positions.filter(p => p.id !== id);
    return {
      positions: remaining,
      gamePhase: remaining.length > 0 ? 'active' : 'idle',
      isLoading: false,
    };
  }),

  addCombatLog: (message, type) =>
    set((state) => ({
      combatLog: [
        { message, timestamp: Date.now(), type },
        ...state.combatLog.slice(0, 9),
      ],
    })),

  incrementCombo: () =>
    set((state) => {
      // Clear existing timer
      if (state.comboTimer) {
        clearTimeout(state.comboTimer);
      }
      const newCombo = state.combo + 1;
      // Reset combo after 10s
      const timer = window.setTimeout(() => {
        get().resetCombo();
      }, 10000);
      return { combo: newCombo, comboTimer: timer };
    }),

  resetCombo: () =>
    set((state) => {
      if (state.comboTimer) {
        clearTimeout(state.comboTimer);
      }
      return { combo: 0, comboTimer: null };
    }),

  addXP: (amount) =>
    set((state) => {
      const newXP = state.xp + amount;
      const newRank = calcRank(newXP);
      return { xp: newXP, rank: newRank };
    }),

  completeMission: (id) =>
    set((state) => {
      const mission = state.missions.find(m => m.id === id);
      if (!mission || mission.completed) return {};
      const updatedMissions = state.missions.map(m =>
        m.id === id ? { ...m, completed: true } : m
      );
      const newXP = state.xp + mission.reward;
      const newRank = calcRank(newXP);
      return {
        missions: updatedMissions,
        xp: newXP,
        rank: newRank,
      };
    }),

  updateMissionProgress: (type, value) =>
    set((state) => {
      const newProgress = { ...state.missionProgress };
      const missionsByType = state.missions.filter(m => m.type === type && !m.completed);

      let updatedMissions = state.missions;
      let newXP = state.xp;

      for (const mission of missionsByType) {
        const currentProgress = newProgress[mission.id] || 0;
        let newValue: number;

        // For profit type, track the single best value (not cumulative)
        if (type === 'profit') {
          newValue = Math.max(currentProgress, value);
        } else {
          // For counts, accumulate
          newValue = currentProgress + value;
        }
        newProgress[mission.id] = newValue;

        // Check completion
        if (newValue >= mission.target && !mission.completed) {
          updatedMissions = updatedMissions.map(m =>
            m.id === mission.id ? { ...m, completed: true } : m
          );
          newXP += mission.reward;
        }
      }

      return {
        missionProgress: newProgress,
        missions: updatedMissions,
        xp: newXP,
        rank: calcRank(newXP),
      };
    }),

  updateSessionStats: (pnl, isWin) =>
    set((state) => ({
      sessionStats: {
        totalTrades: state.sessionStats.totalTrades + 1,
        wins: state.sessionStats.wins + (isWin ? 1 : 0),
        bestPnl: Math.max(state.sessionStats.bestPnl, pnl),
        totalPnl: state.sessionStats.totalPnl + pnl,
      },
    })),

  toggleLightMode: () => set((state) => ({ lightMode: !state.lightMode })),
  setMarketStats: (stats) => set({ marketStats: stats }),
  recordSymbolLeverage: (symbol, leverage) => set((state) => ({
    symbolLeverages: { ...state.symbolLeverages, [symbol]: leverage },
  })),

  setSelectedSymbol: (symbol) =>
    set((state) => {
      const entry = state.allMarketPrices[symbol];
      const price = entry?.price ?? state.currentPrice;
      const newBuffer = Array(DISPLAY_POINTS).fill(price);
      const newTsBuffer = defaultTimestamps(DISPLAY_POINTS, 60_000);
      return {
        selectedSymbol: symbol,
        currentPrice: price,
        priceBuffer: newBuffer,
        timestampBuffer: newTsBuffer,
        priceHistory: newBuffer.slice(-DISPLAY_POINTS),
        priceTimestamps: newTsBuffer.slice(-DISPLAY_POINTS),
        // Reset volumes so stale data from the previous symbol never bleeds through
        volumeHistory: Array(DISPLAY_POINTS).fill(0),
        marketStats: entry ? { funding: entry.funding, openInterest: entry.openInterest, volume24h: entry.volume24h } : null,
      };
    }),

  setAllMarketPrices: (entries) =>
    set((state) => {
      const newMap: Record<string, MarketEntry> = { ...state.allMarketPrices };
      for (const e of entries) {
        newMap[e.symbol] = e;
      }

      const entry = newMap[state.selectedSymbol];
      if (!entry) return { allMarketPrices: newMap };

      const price = entry.price;

      // Live tick: update current price and replace the last candle close with the
      // live price so the rightmost bar tracks real-time movement. Do NOT append a
      // new entry — that would corrupt the timeframe-correct candle series loaded by
      // setHistoricalData.
      const updatedHistory = state.priceHistory.length > 0
        ? [...state.priceHistory.slice(0, -1), price]
        : [price];
      const updatedTsHistory = state.priceTimestamps.length > 0
        ? [...state.priceTimestamps.slice(0, -1), Date.now()]
        : [Date.now()];

      return {
        allMarketPrices: newMap,
        currentPrice: price,
        priceHistory: updatedHistory,
        priceTimestamps: updatedTsHistory,
        marketStats: { funding: entry.funding, openInterest: entry.openInterest, volume24h: entry.volume24h },
      };
    }),
}), {
  name: 'broadside-game-state',
  storage: createJSONStorage(() => ({
    getItem: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
    setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* quota exceeded or private browsing */ } },
    removeItem: (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  })),
  partialize: (state) => ({
    positions: state.positions,
    gamePhase: state.gamePhase === 'active' ? 'active' : 'idle',
    selectedSymbol: state.selectedSymbol,
    leverage: state.leverage,
    tradeSize: state.tradeSize,
    selectedSide: state.selectedSide,
    xp: state.xp,
    rank: state.rank,
    sessionStats: state.sessionStats,
    symbolLeverages: state.symbolLeverages,
  }),
}));
