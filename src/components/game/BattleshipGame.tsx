'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { soundEngine } from '@/lib/soundEngine';

let phaserInstance: unknown = null;

class BattleScene {
  // Will be properly typed after Phaser loads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const COINGECKO_IDS: Record<string, string> = {
  // Major crypto
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  AVAX: 'avalanche-2', XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano',
  LINK: 'chainlink', SUI: 'sui', TON: 'the-open-network', NEAR: 'near',
  ICP: 'internet-computer', TAO: 'bittensor', LTC: 'litecoin', BCH: 'bitcoin-cash',
  XMR: 'monero', ZEC: 'zcash', PAXG: 'pax-gold', VIRTUAL: 'virtual-protocol',
  // Meme / community
  HYPE: 'hyperliquid', kPEPE: 'pepe', kBONK: 'bonk', TRUMP: 'official-trump',
  WIF: 'dogwifcoin', PENGU: 'pudgy-penguins', FARTCOIN: 'fartcoin',
  // DeFi
  UNI: 'uniswap', AAVE: 'aave', CRV: 'curve-dao-token', LDO: 'lido-dao',
  ARB: 'arbitrum', JUP: 'jupiter-exchange-solana', ENA: 'ethena',
  ZK: 'zksync', STRK: 'starknet', ZRO: 'layerzero', WLD: 'worldcoin-wld',
  LINEA: 'linea',
  // Others with known CoinGecko IDs
  URNM: 'sprott-uranium-miners-etf-trust',
};

const STOCK_LOGOS: Record<string, string> = {
  TSLA: 'https://logo.clearbit.com/tesla.com',
  NVDA: 'https://logo.clearbit.com/nvidia.com',
  GOOGL: 'https://logo.clearbit.com/google.com',
  PLTR: 'https://logo.clearbit.com/palantir.com',
  HOOD: 'https://logo.clearbit.com/robinhood.com',
};

export default function BattleshipGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameRef = useRef<any>(null);
  const store = useGameStore();
  const storeRef = useRef(store);
  const logoUrlsRef = useRef<Record<string, string>>({ ...STOCK_LOGOS });

  useEffect(() => {
    storeRef.current = store;
  });

  // Fetch coin logos from CoinGecko once on mount
  useEffect(() => {
    const ids = Object.values(COINGECKO_IDS).join(',');
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=100`)
      .then(r => r.json())
      .then((coins: Array<{ id: string; image: string }>) => {
        const idToSym = Object.fromEntries(
          Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym])
        );
        for (const coin of coins) {
          const sym = idToSym[coin.id];
          if (sym && coin.image) {
            // Convert large → thumb for smaller file size
            logoUrlsRef.current[sym] = coin.image.replace('/large/', '/thumb/');
          }
        }
      })
      .catch(() => { /* use text fallback */ });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!containerRef.current) return;

    let mounted = true;

    const initPhaser = async () => {
      const Phaser = (await import('phaser')).default;
      if (!mounted) return;

      class BattleSceneImpl extends Phaser.Scene {
        // Game objects
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private shipGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private fortressGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private waveGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private healthBarGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private bgGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private bgLayersGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private particleGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private crosshairGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private overlayGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private reflectionGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private scanlineGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private smokeParticles: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private waterParticles: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private priceText!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private phaseText!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private pnlText!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private comboText!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private liqExplosionLabel!: any;
        private entryTimestamp = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private hoverGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private hoverPriceLabel!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private hoverTimeLabel!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private hoverVolumeLabel!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private priceScaleGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private priceScaleLabels: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private timeTickLabels: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private currentPriceLabel!: any;

        private celestialZoneX = 0;
        private celestialZoneY = 0;
        private celestialZoneR = 0;

        private waveTime = 0;
        private shipRockTime = 0;
        private splinePoints: { x: number; y: number }[] = [];
        private terrainCtrl: { x: number; y: number }[] = [];
        private chartMinP = 0;
        private chartMaxP = 0;
        // Shared chart viewport — set in drawWaves, read by drawPriceScale + drawPriceZones
        private chartTopY = 0;
        private chartBotY = 0;
        private chartViewMin = 0;
        private chartViewMax = 0;
        private hoverX = -1;
        private hoverY = -1;
        private hoverPinned = false;
        private pinnedX = -1;
        private volumeHistory: number[] = Array(30).fill(0);
        private marginHealth = 100;
        private gamePhase = 'idle';
        private priceHistory: number[] = Array(20).fill(65000);
        private priceTimestamps: number[] = Array(20).fill(Date.now());
        private currentPrice = 65000;
        private timeframe = '1m';
        private shipY = 320;
        private isSinking = false;
        private sinkProgress = 0;
        private explosionParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];
        private unrealizedPnl = 0;
        private frameCount = 0;
        private lightMode = false;

        // New state
        private fortressDamage = 0;
        private floatingTexts: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          obj: any;
          vy: number;
          life: number;
          maxLife: number;
        }[] = [];
        private crosshairProgress = 0;
        private lastPriceTickSound = 0;
        private fortressFireParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
        private lastCombo = 0;
        private entryPrice = 0;
        private positionSide: 'long' | 'short' | null = null;
        private liquidationPrice = 0;

        // Parallax background state
        private stars: { x: number; y: number; baseAlpha: number; phase: number }[] = [];
        private fogBanks: { x: number; y: number; w: number; h: number; speed: number }[] = [];

        // Turret angle for cannon rotation
        private turretAngle = 0;

        // Shockwave particles for impacts
        private shockwaves: { x: number; y: number; radius: number; maxRadius: number; life: number }[] = [];
        private debrisParticles: { x: number; y: number; vx: number; vy: number; life: number; w: number; h: number; color: number }[] = [];

        // Weather system
        private stormIntensity = 0; // 0=calm, 1=full storm
        private rainDrops: { x: number; y: number; len: number; speed: number }[] = [];
        private lightningAlpha = 0;
        private lightningTimer = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private weatherGraphics!: any;

        // Wake trail
        private wakeParticles: { x: number; y: number; vx: number; life: number; size: number; alpha: number }[] = [];

        // Hull sparks
        private sparkParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

        // Win/loss celebration
        private coinParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number; rot: number; rotSpeed: number }[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private celebrationGraphics!: any;

        // Symbol display on fortress
        private selectedSymbol = 'BTC';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private symbolLabel!: any;   // text fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private symbolImage!: any;   // logo image (shown when loaded)
        private symbolColorHex = 0xff6600;
        private symbolLogoUrl: string | null = null;

        private fmtPrice(price: number): string {
          if (price >= 10000) return `$${Math.round(price).toLocaleString()}`;
          if (price >= 1000) return `$${price.toFixed(1)}`;
          if (price >= 100)  return `$${price.toFixed(2)}`;
          if (price >= 1)    return `$${price.toFixed(3)}`;
          if (price >= 0.01) return `$${price.toFixed(4)}`;
          if (price >= 0.0001) return `$${price.toFixed(6)}`;
          return `$${price.toExponential(2)}`;
        }

        private getSymbolColor(symbol: string): { colorHex: number; cssColor: string } {
          const MEME = ['kPEPE', 'kBONK', 'FARTCOIN', 'TRUMP', 'WIF', 'PENGU', 'HYPE'];
          const STOCKS = ['TSLA', 'NVDA', 'GOOGL', 'PLTR', 'HOOD'];
          const COMMODITIES = ['XAU', 'XAG', 'CL', 'NATGAS', 'COPPER', 'PLATINUM'];
          const FOREX = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDKRW'];
          const DEFI = ['UNI', 'AAVE', 'CRV', 'LDO', 'ARB', 'JUP'];
          if (symbol === 'BTC') return { colorHex: 0xff6600, cssColor: '#ff6600' };
          if (symbol === 'ETH') return { colorHex: 0x8899ff, cssColor: '#8899ff' };
          if (MEME.includes(symbol)) return { colorHex: 0xff44ff, cssColor: '#ff44ff' };
          if (STOCKS.includes(symbol)) return { colorHex: 0x44aaff, cssColor: '#44aaff' };
          if (COMMODITIES.includes(symbol)) return { colorHex: 0xffd700, cssColor: '#ffd700' };
          if (FOREX.includes(symbol)) return { colorHex: 0x00ff88, cssColor: '#00ff88' };
          if (DEFI.includes(symbol)) return { colorHex: 0xaa44ff, cssColor: '#aa44ff' };
          return { colorHex: 0x00d4ff, cssColor: '#00d4ff' };
        }

        private loadSymbolLogo(symbol: string, url: string) {
          const key = `logo-${symbol}`;
          if (this.textures.exists(key)) {
            this.symbolImage.setTexture(key);
            this.symbolImage.setScale(1.4);
            this.symbolImage.setVisible(true);
            this.symbolLabel.setVisible(false);
            return;
          }
          // Show text while loading
          this.symbolImage.setVisible(false);
          this.symbolLabel.setVisible(true);
          this.load.image(key, url);
          this.load.once('complete', () => {
            if (this.selectedSymbol === symbol && this.symbolImage) {
              this.symbolImage.setTexture(key);
              this.symbolImage.setScale(1.4);
              this.symbolImage.setVisible(true);
              this.symbolLabel.setVisible(false);
            }
          });
          this.load.once('loaderror', () => {
            // Keep text fallback on load error
          });
          this.load.start();
        }

        constructor() {
          super({ key: 'BattleScene' });
        }

        preload() {}

        create() {
          const { width, height } = this.scale;

          // Layer 0: Sky background (redrawn each frame)
          this.bgGraphics = this.add.graphics();
          this.bgGraphics.setDepth(0);

          // Layer 1: Parallax background layers (cliffs, fog, lighthouse etc.)
          this.bgLayersGraphics = this.add.graphics();
          this.bgLayersGraphics.setDepth(1);

          // Initialize stars
          this.initStars(width, height);

          // Initialize fog banks
          this.initFogBanks(width, height);

          // Wave graphics
          this.waveGraphics = this.add.graphics();
          this.waveGraphics.setDepth(4);

          // Overlay graphics (price zones)
          this.overlayGraphics = this.add.graphics();
          this.overlayGraphics.setDepth(5);

          // Reflection graphics
          this.reflectionGraphics = this.add.graphics();
          this.reflectionGraphics.setDepth(6);

          // Ship graphics
          this.shipGraphics = this.add.graphics();
          this.shipGraphics.setDepth(8);
          // Place hull waterline stripe (y+9 in ship-local coords) exactly at water surface
          this.shipY = height * 0.68 - 9;

          // Fortress graphics
          this.fortressGraphics = this.add.graphics();
          this.fortressGraphics.setDepth(8);

          // Symbol display — centered on fortress body
          const waterY = height * 0.68;
          const fortressX = width * 0.75;
          const fortressY = waterY - 65;
          const initColor = this.getSymbolColor('BTC');
          this.symbolColorHex = initColor.colorHex;
          // Text fallback (visible until logo loads)
          this.symbolLabel = this.add.text(fortressX, fortressY + 10, 'BTC', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: initColor.cssColor,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
          }).setOrigin(0.5, 0.5).setDepth(9).setAlpha(0.92);
          // Logo image (hidden until loaded)
          this.symbolImage = this.add.image(fortressX, fortressY + 10, '__DEFAULT')
            .setOrigin(0.5, 0.5).setDepth(9).setAlpha(0.92).setVisible(false);

          // Particle layer
          this.particleGraphics = this.add.graphics();
          this.particleGraphics.setDepth(15);

          // Health bar
          this.healthBarGraphics = this.add.graphics();
          this.healthBarGraphics.setDepth(18);

          // Crosshair layer
          this.crosshairGraphics = this.add.graphics();
          this.crosshairGraphics.setDepth(25);

          // Scanline overlay (top-most)
          this.scanlineGraphics = this.add.graphics();
          this.scanlineGraphics.setDepth(50);

          // Weather graphics (above sky, below parallax)
          this.weatherGraphics = this.add.graphics();
          this.weatherGraphics.setDepth(3);

          // Celebration graphics
          this.celebrationGraphics = this.add.graphics();
          this.celebrationGraphics.setDepth(45);

          // Init rain drops
          for (let i = 0; i < 120; i++) {
            this.rainDrops.push({
              x: Math.random() * 1600,
              y: Math.random() * 600,
              len: 8 + Math.random() * 12,
              speed: 8 + Math.random() * 6,
            });
          }

          // Price scale axis
          this.priceScaleGraphics = this.add.graphics();
          this.priceScaleGraphics.setDepth(19);

          // 6 price tick labels (evenly spaced from waterY to sea floor)
          for (let i = 0; i < 6; i++) {
            const label = this.add.text(0, 0, '', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#4a7a9b',
              stroke: '#000000',
              strokeThickness: 1,
            }).setOrigin(1, 0.5).setDepth(20);
            this.priceScaleLabels.push(label);
          }

          // 30 time tick labels — one per candle display point
          for (let i = 0; i < 30; i++) {
            const label = this.add.text(0, 0, '', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#2a5a7c',
              stroke: '#000000',
              strokeThickness: 1,
            }).setOrigin(0.5, 0).setDepth(20).setVisible(false);
            this.timeTickLabels.push(label);
          }

          // Current price badge — large floating label
          this.currentPriceLabel = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#00cc44',
            padding: { x: 4, y: 2 },
            stroke: '#000000',
            strokeThickness: 2,
          }).setOrigin(1, 0.5).setDepth(22);

          // Hover crosshair + dot layer
          this.hoverGraphics = this.add.graphics();
          this.hoverGraphics.setDepth(22);

          // Hover price tag
          this.hoverPriceLabel = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#0a1e38',
            padding: { x: 5, y: 3 },
            stroke: '#00d4ff',
            strokeThickness: 1,
          }).setOrigin(0, 1).setDepth(23).setVisible(false);

          // Hover time label (shows on time axis)
          this.hoverTimeLabel = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#00d4ff',
            backgroundColor: '#071828',
            padding: { x: 3, y: 1 },
            stroke: '#000000',
            strokeThickness: 1,
          }).setOrigin(0.5, 0).setDepth(23).setVisible(false);

          // Hover volume label (shows near terrain peak)
          this.hoverVolumeLabel = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#aaffbb',
            backgroundColor: '#071828',
            padding: { x: 3, y: 1 },
            stroke: '#000000',
            strokeThickness: 1,
          }).setOrigin(0.5, 1).setDepth(23).setVisible(false);

          // Celestial body (sun/moon) — interactive toggle for day/night
          const celX = width * 0.82;
          const celY = height * 0.12;
          const celRadius = 30;
          const celestialZone = this.add.zone(celX, celY, celRadius * 2, celRadius * 2);
          celestialZone.setInteractive({ useHandCursor: true });
          celestialZone.on('pointerdown', () => {
            useGameStore.getState().toggleLightMode();
          });
          this.celestialZoneX = celX;
          this.celestialZoneY = celY;
          this.celestialZoneR = celRadius;

          // Pointer tracking — only update when not pinned
          this.input.on('pointermove', (pointer: { x: number; y: number }) => {
            if (!this.hoverPinned) {
              this.hoverX = pointer.x;
              this.hoverY = pointer.y;
            }
          });
          this.input.on('pointerout', () => {
            if (!this.hoverPinned) {
              this.hoverX = -1;
              this.hoverY = -1;
            }
          });
          // Click in sea: pin/unpin. Click above water: dismiss.
          this.input.on('pointerdown', (pointer: { x: number; y: number }) => {
            // Skip if clicking the celestial body (handled by its own zone)
            const dx = pointer.x - this.celestialZoneX;
            const dy = pointer.y - this.celestialZoneY;
            if (Math.sqrt(dx * dx + dy * dy) < this.celestialZoneR) return;

            const wY = this.scale.height * 0.68;
            if (pointer.y > wY) {
              if (this.hoverPinned && Math.abs(pointer.x - this.pinnedX) < 24) {
                this.hoverPinned = false;
                this.pinnedX = -1;
              } else {
                this.hoverPinned = true;
                this.pinnedX = pointer.x;
                this.hoverX = pointer.x;
                this.hoverY = pointer.y;
              }
            } else {
              this.hoverPinned = false;
              this.pinnedX = -1;
              this.hoverX = -1;
              this.hoverY = -1;
            }
          });

          // Price text (hidden — price shown in HUD instead)
          this.priceText = this.add.text(0, 0, '').setVisible(false);

          // Liquidation price explosion marker
          this.liqExplosionLabel = this.add.text(0, 0, '💥', {
            fontSize: '18px',
          }).setOrigin(0.5, 0.5).setDepth(6).setVisible(false);


          // Phase text (hidden — phase shown in HUD instead)
          this.phaseText = this.add.text(0, 0, '').setVisible(false);

          // PnL text (hidden — PnL shown in HUD instead)
          this.pnlText = this.add.text(0, 0, '').setVisible(false);

          // Combo flash text
          this.comboText = this.add.text(width / 2, height / 2 - 40, '', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3,
          }).setOrigin(0.5, 0.5).setDepth(30).setAlpha(0);

          // Listen for game events
          this.game.events.on('updateState', (state: {
            currentPrice: number;
            priceHistory: number[];
            priceTimestamps: number[];
            volumeHistory: number[];
            marginHealth: number;
            gamePhase: string;
            unrealizedPnl: number;
            combo: number;
            entryPrice: number;
            positionSide: 'long' | 'short' | null;
            liquidationPrice: number;
            openedAt: number;
            timeframe: string;
            lightMode: boolean;
            selectedSymbol: string;
            symbolLogoUrl: string | null;
          }) => {
            this.currentPrice = state.currentPrice;
            this.priceHistory = state.priceHistory;
            this.priceTimestamps = state.priceTimestamps;
            this.volumeHistory = state.volumeHistory;
            this.timeframe = state.timeframe;
            this.lightMode = state.lightMode;
            this.marginHealth = state.marginHealth;

            // Update fortress symbol display when market changes
            if (state.selectedSymbol !== this.selectedSymbol || state.symbolLogoUrl !== this.symbolLogoUrl) {
              this.selectedSymbol = state.selectedSymbol;
              this.symbolLogoUrl = state.symbolLogoUrl;
              const col = this.getSymbolColor(state.selectedSymbol);
              this.symbolColorHex = col.colorHex;
              // Update text fallback
              if (this.symbolLabel) {
                this.symbolLabel.setText(state.selectedSymbol.slice(0, 6));
                this.symbolLabel.setStyle({ color: col.cssColor });
                const fs = state.selectedSymbol.length <= 3 ? '32px' : state.selectedSymbol.length <= 5 ? '26px' : '20px';
                this.symbolLabel.setFontSize(fs);
                this.symbolLabel.setVisible(true);
              }
              if (this.symbolImage) {
                this.symbolImage.setVisible(false);
              }
              // Load logo if URL available
              if (state.symbolLogoUrl) {
                this.loadSymbolLogo(state.selectedSymbol, state.symbolLogoUrl);
              }
            }
            this.unrealizedPnl = state.unrealizedPnl;
            this.entryPrice = state.entryPrice;
            this.entryTimestamp = state.openedAt;
            this.positionSide = state.positionSide;
            this.liquidationPrice = state.liquidationPrice;

            // Price tick sound
            const now = Date.now();
            if (now - this.lastPriceTickSound > 2000) {
              soundEngine.playPriceTick();
              this.lastPriceTickSound = now;
            }

            // Combo flash banner
            if (state.combo >= 3 && state.combo !== this.lastCombo) {
              this.lastCombo = state.combo;
              this.comboText.setText(`CHAIN x${state.combo}`);
              this.comboText.setAlpha(1);
              this.comboText.setScale(1.5);
              this.tweens.add({
                targets: this.comboText,
                scaleX: 1,
                scaleY: 1,
                alpha: 0,
                duration: 1500,
                ease: 'Sine.easeOut',
              });
            }

            const prevPhase = this.gamePhase;
            this.gamePhase = state.gamePhase;

            this.priceText.setText(this.fmtPrice(state.currentPrice));

            const phaseMessages: Record<string, string> = {
              idle: 'AWAITING ORDERS',
              aiming: 'ACQUIRING TARGET...',
              firing: 'CANNONS FIRED!',
              active: 'POSITION ACTIVE',
              retreating: 'FLEET RETREATING...',
              sunk: 'SHIP LOST!',
            };
            this.phaseText.setText(phaseMessages[state.gamePhase] || 'AWAITING ORDERS');

            if (state.unrealizedPnl !== undefined && state.unrealizedPnl !== 0) {
              const pnlColor = state.unrealizedPnl >= 0 ? '#00ff88' : '#ff3333';
              this.pnlText.setColor(pnlColor);
              this.pnlText.setText(`PnL: ${state.unrealizedPnl >= 0 ? '+' : ''}$${state.unrealizedPnl.toFixed(2)}`);
            } else {
              this.pnlText.setText('');
            }

            // On transition to aiming: set turret angle toward fortress
            if (state.gamePhase === 'aiming' && prevPhase !== 'aiming') {
              const { width: w, height: h } = this.scale;
              const shipX = w * 0.2;
              const fortressX = w * 0.75;
              const waterY = h * 0.68;
              const fortressY = waterY - 65;
              this.turretAngle = Math.atan2(fortressY - this.shipY, fortressX - shipX);
            }

            // Only trigger cannon animation on transition INTO 'firing'
            if (state.gamePhase === 'firing' && prevPhase !== 'firing') {
              this.fireCannon();
            }

            if (state.gamePhase === 'sunk' && !this.isSinking) {
              this.triggerSink();
              soundEngine.playExplosion();
            }

            // Win/loss celebration when position closes
            if (prevPhase === 'active' && state.gamePhase === 'idle') {
              const closePnl = state.unrealizedPnl;
              const { width: w, height: h } = this.scale;
              if (closePnl > 0) {
                this.triggerWinCelebration(closePnl, w, h);
              } else if (closePnl < 0) {
                this.triggerLossCelebration(closePnl, w);
              }
            }

            // Reset fortress damage when position closes
            if (state.gamePhase === 'idle' && prevPhase !== 'idle') {
              this.fortressDamage = 0;
              this.crosshairProgress = 0;
            }
          });

          this.game.events.on('torpedo', () => {
            this.fireTorpedo();
            soundEngine.playTorpedoHit();
          });
        }

        private initStars(width: number, height: number) {
          this.stars = [];
          for (let i = 0; i < 120; i++) {
            this.stars.push({
              x: Math.random() * width,
              y: Math.random() * height * 0.5,
              baseAlpha: 0.3 + Math.random() * 0.7,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }

        private initFogBanks(width: number, height: number) {
          const waterY = height * 0.68;
          this.fogBanks = [];
          for (let i = 0; i < 5; i++) {
            this.fogBanks.push({
              x: Math.random() * width,
              y: waterY - 20 - Math.random() * 40,
              w: 150 + Math.random() * 150,
              h: 30 + Math.random() * 30,
              speed: 8 + Math.random() * 12,
            });
          }
        }

        private computeVolatility(): number {
          const prices = this.priceHistory;
          if (prices.length < 5) return 0;
          const changes = prices.slice(1).map((p, i) => Math.abs((p - prices[i]) / Math.max(prices[i], 1)));
          const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
          return Math.min(1, avg / 0.008);
        }

        private drawWeather(width: number, height: number, time: number) {
          this.weatherGraphics.clear();
          const vol = this.stormIntensity;
          if (vol < 0.2) return;

          const waterY = height * 0.68;

          // Storm clouds (dark rolling clouds at top)
          const cloudAlpha = Math.min(0.85, (vol - 0.2) / 0.8 * 0.85);
          const cloudCount = Math.floor(vol * 8) + 2;
          for (let c = 0; c < cloudCount; c++) {
            const cx = ((c / cloudCount) * width * 1.3 + time * 12) % (width + 200) - 100;
            const cy = height * 0.05 + (c % 3) * 22;
            const cw = 120 + (c % 3) * 60;
            const ch = 28 + (c % 2) * 14;
            const cloudColor = this.lightMode ? 0x607080 : 0x0a0f1a;
            this.weatherGraphics.fillStyle(cloudColor, cloudAlpha);
            this.weatherGraphics.fillEllipse(cx, cy, cw, ch);
            this.weatherGraphics.fillEllipse(cx + 30, cy - 10, cw * 0.7, ch * 0.8);
            this.weatherGraphics.fillEllipse(cx - 25, cy - 5, cw * 0.6, ch * 0.7);
          }

          // Rain streaks
          const rainAlpha = Math.min(0.55, (vol - 0.3) / 0.7 * 0.55);
          if (vol > 0.3) {
            const rainColor = this.lightMode ? 0x4488aa : 0x4499cc;
            this.weatherGraphics.lineStyle(1, rainColor, rainAlpha);
            for (const drop of this.rainDrops) {
              drop.y += drop.speed;
              drop.x += drop.speed * 0.2;
              if (drop.y > waterY + 20 || drop.x > width + 20) {
                drop.y = -20;
                drop.x = Math.random() * width;
              }
              this.weatherGraphics.beginPath();
              this.weatherGraphics.moveTo(drop.x, drop.y);
              this.weatherGraphics.lineTo(drop.x + 2, drop.y + drop.len);
              this.weatherGraphics.strokePath();
            }
          }

          // Lightning flash at very high volatility
          if (vol > 0.7) {
            this.lightningTimer -= 0.016;
            if (this.lightningTimer <= 0) {
              if (Math.random() < 0.008) {
                this.lightningAlpha = 0.35;
                this.lightningTimer = 3 + Math.random() * 5;

                const lx = width * 0.3 + Math.random() * width * 0.5;
                const bolt: { x: number; y: number }[] = [];
                let bx = lx, by = 0;
                while (by < waterY) {
                  bolt.push({ x: bx, y: by });
                  bx += (Math.random() - 0.5) * 30;
                  by += 20 + Math.random() * 20;
                }
                this.weatherGraphics.lineStyle(2, 0xeeeeff, this.lightningAlpha);
                if (bolt.length > 1) {
                  this.weatherGraphics.beginPath();
                  this.weatherGraphics.moveTo(bolt[0].x, bolt[0].y);
                  for (const pt of bolt.slice(1)) this.weatherGraphics.lineTo(pt.x, pt.y);
                  this.weatherGraphics.strokePath();
                }
              }
            }
            if (this.lightningAlpha > 0) {
              this.lightningAlpha = Math.max(0, this.lightningAlpha - 0.04);
              this.weatherGraphics.fillStyle(0xeeeeff, this.lightningAlpha * 0.15);
              this.weatherGraphics.fillRect(0, 0, width, height);
            }
          }
        }

        private drawBackground(width: number, height: number, health: number, phase: string, pnl: number, time: number) {
          this.bgGraphics.clear();

          // --- Sky gradient based on health/phase ---
          let topR: number, topG: number, topB: number;
          let botR: number, botG: number, botB: number;

          if (this.lightMode) {
            topR = 100; topG = 180; topB = 240;
            botR = 160; botG = 220; botB = 255;
          } else {
            topR = 10; topG = 20; topB = 40;
            botR = 26; botG = 58; botB = 92;
          }

          if (health < 40) {
            topR = 26; topG = 8; topB = 8;
            botR = 58; botG = 8; botB = 8;
          } else if (health < 70 && !this.lightMode) {
            topR = 26; topG = 16; topB = 32;
            botR = 58; botG = 26; botB = 16;
          } else if (phase === 'active' && pnl > 0 && !this.lightMode) {
            topR = 10; topG = 20; topB = 32;
            botR = 26; botG = 42; botB = 16;
          }

          for (let i = 0; i < height; i++) {
            const t = i / height;
            const r = Math.round(topR + (botR - topR) * t);
            const g = Math.round(topG + (botG - topG) * t);
            const b = Math.round(topB + (botB - topB) * t);
            const color = (r << 16) | (g << 8) | b;
            this.bgGraphics.fillStyle(color, 1);
            this.bgGraphics.fillRect(0, i, width, 1);
          }

          // Dark clouds when critical
          if (health < 40) {
            for (let c = 0; c < 5; c++) {
              const cx = (c / 5) * width + 60;
              const cy = height * 0.12 + (c % 2) * 20;
              this.bgGraphics.fillStyle(0x1a0505, 0.7);
              this.bgGraphics.fillEllipse(cx, cy, 80 + c * 15, 25);
            }
          }

          // Storm intensity overlay
          if (this.stormIntensity > 0.3) {
            const stormAlpha = Math.min(0.4, (this.stormIntensity - 0.3) / 0.7 * 0.4);
            this.bgGraphics.fillStyle(0x050a12, stormAlpha);
            this.bgGraphics.fillRect(0, 0, width, height);
          }
        }

        private drawParallaxLayers(width: number, height: number, time: number, delta: number) {
          this.bgLayersGraphics.clear();
          const waterY = height * 0.68;

          const celestialX = width * 0.82;
          const celestialY = height * 0.12;

          if (!this.lightMode) {
            // --- Twinkling stars ---
            for (const star of this.stars) {
              const alpha = star.baseAlpha * (0.5 + 0.5 * Math.sin(time * 2 + star.phase));
              this.bgLayersGraphics.fillStyle(0xffffff, alpha);
              const size = star.baseAlpha > 0.7 ? 1.5 : 1;
              this.bgLayersGraphics.fillCircle(star.x, star.y, size);
            }

            // --- Moon with glow halos ---
            this.bgLayersGraphics.fillStyle(0xffffff, 0.03);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 50);
            this.bgLayersGraphics.fillStyle(0xffffff, 0.06);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 35);
            this.bgLayersGraphics.fillStyle(0xffffff, 0.12);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 25);
            this.bgLayersGraphics.fillStyle(0xeeeedd, 0.95);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 20);

            // --- Moon reflection on water ---
            for (let ry = waterY; ry < waterY + 80; ry += 2) {
              const dist = ry - waterY;
              const shimmerAlpha = 0.02 + 0.06 * Math.max(0, 1 - dist / 80) * (0.5 + 0.5 * Math.sin(ry * 0.3 + time * 1.5));
              const shimmerW = 20 - dist * 0.15;
              if (shimmerW > 1) {
                this.bgLayersGraphics.fillStyle(0xffffff, shimmerAlpha);
                this.bgLayersGraphics.fillRect(celestialX - shimmerW / 2, ry, shimmerW, 2);
              }
            }
          } else {
            // --- Sun with glow halos ---
            this.bgLayersGraphics.fillStyle(0xffee88, 0.08);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 60);
            this.bgLayersGraphics.fillStyle(0xffdd44, 0.15);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 42);
            this.bgLayersGraphics.fillStyle(0xffcc00, 0.35);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 28);
            this.bgLayersGraphics.fillStyle(0xffee88, 1);
            this.bgLayersGraphics.fillCircle(celestialX, celestialY, 20);

            // --- Sun sparkle rays ---
            this.bgLayersGraphics.lineStyle(1.5, 0xffcc00, 0.5);
            for (let r = 0; r < 8; r++) {
              const angle = (r / 8) * Math.PI * 2 + time * 0.3;
              const rx1 = celestialX + Math.cos(angle) * 28;
              const ry1 = celestialY + Math.sin(angle) * 28;
              const rx2 = celestialX + Math.cos(angle) * 44;
              const ry2 = celestialY + Math.sin(angle) * 44;
              this.bgLayersGraphics.beginPath();
              this.bgLayersGraphics.moveTo(rx1, ry1);
              this.bgLayersGraphics.lineTo(rx2, ry2);
              this.bgLayersGraphics.strokePath();
            }

            // --- Sun reflection on water ---
            for (let ry = waterY; ry < waterY + 80; ry += 2) {
              const dist = ry - waterY;
              const shimmerAlpha = 0.04 + 0.1 * Math.max(0, 1 - dist / 80) * (0.5 + 0.5 * Math.sin(ry * 0.3 + time * 1.5));
              const shimmerW = 24 - dist * 0.18;
              if (shimmerW > 1) {
                this.bgLayersGraphics.fillStyle(0xffdd44, shimmerAlpha);
                this.bgLayersGraphics.fillRect(celestialX - shimmerW / 2, ry, shimmerW, 2);
              }
            }
          }

          // --- Left cliff silhouette ---
          const cliffColor = this.lightMode ? 0x607080 : 0x1a2030;
          this.bgLayersGraphics.fillStyle(cliffColor, 1);
          // Jagged left cliff
          const cliffPts = [
            { x: 0, y: waterY + 20 },
            { x: 0, y: waterY - 80 },
            { x: 20, y: waterY - 110 },
            { x: 40, y: waterY - 90 },
            { x: 55, y: waterY - 120 },
            { x: 70, y: waterY - 95 },
            { x: 90, y: waterY - 105 },
            { x: 110, y: waterY - 80 },
            { x: 130, y: waterY - 60 },
            { x: 160, y: waterY - 40 },
            { x: 200, y: waterY - 20 },
            { x: 200, y: waterY + 20 },
          ];
          this.bgLayersGraphics.beginPath();
          this.bgLayersGraphics.moveTo(cliffPts[0].x, cliffPts[0].y);
          for (const pt of cliffPts.slice(1)) {
            this.bgLayersGraphics.lineTo(pt.x, pt.y);
          }
          this.bgLayersGraphics.closePath();
          this.bgLayersGraphics.fillPath();


          // --- Right cliff behind fortress ---
          const rCliffPts = [
            { x: width, y: waterY + 20 },
            { x: width, y: waterY - 60 },
            { x: width - 30, y: waterY - 80 },
            { x: width - 60, y: waterY - 70 },
            { x: width - 90, y: waterY - 90 },
            { x: width - 120, y: waterY - 65 },
            { x: width - 150, y: waterY - 50 },
            { x: width - 180, y: waterY - 30 },
            { x: width - 200, y: waterY - 20 },
            { x: width - 200, y: waterY + 20 },
          ];
          this.bgLayersGraphics.fillStyle(cliffColor, 1);
          this.bgLayersGraphics.beginPath();
          this.bgLayersGraphics.moveTo(rCliffPts[0].x, rCliffPts[0].y);
          for (const pt of rCliffPts.slice(1)) {
            this.bgLayersGraphics.lineTo(pt.x, pt.y);
          }
          this.bgLayersGraphics.closePath();
          this.bgLayersGraphics.fillPath();

          // --- Lighthouse (left background) ---
          // Keep lhX within the cliff polygon's x-range (0–200px) so it always sits on rock
          const lhX = Math.min(width * 0.12, 80);
          // Interpolate exact cliff surface height at lhX using the same cliffPts polygon
          const lhTopPts = cliffPts.slice(1, -1); // drop the bottom-fill points
          let lhCliffY = waterY - 80;
          for (let ci = 0; ci < lhTopPts.length - 1; ci++) {
            const a = lhTopPts[ci], b = lhTopPts[ci + 1];
            if (lhX >= a.x && lhX <= b.x) {
              const t = (lhX - a.x) / (b.x - a.x);
              lhCliffY = a.y + t * (b.y - a.y);
              break;
            }
          }
          // Lantern sits 55px above the cliff surface
          const lhY = lhCliffY - 55;
          // Rocky base: sits flush on cliff top
          this.bgLayersGraphics.fillStyle(this.lightMode ? 0x607080 : 0x1a1a24, 0.9);
          this.bgLayersGraphics.fillEllipse(lhX, lhCliffY + 4, 40, 14);
          // Tower: from lantern level down into rocky base (8px overlap)
          this.bgLayersGraphics.fillStyle(0xd0d0c0, 0.9);
          this.bgLayersGraphics.fillRect(lhX - 4, lhY, 8, 63);
          // Lantern house
          this.bgLayersGraphics.fillStyle(0xf0f0e0, 0.9);
          this.bgLayersGraphics.fillRect(lhX - 6, lhY - 10, 12, 10);
          // Lantern light
          this.bgLayersGraphics.fillStyle(this.lightMode ? 0xffdd00 : 0x00d4ff, 0.9);
          this.bgLayersGraphics.fillCircle(lhX, lhY - 5, 4);

          // Lighthouse beam (oscillating)
          const beamAngle = Math.sin(time * 0.5) * 0.8;
          this.bgLayersGraphics.save();
          this.bgLayersGraphics.translateCanvas(lhX, lhY - 5);
          this.bgLayersGraphics.rotateCanvas(beamAngle);
          this.bgLayersGraphics.fillStyle(0x00d4ff, 0.06);
          // Triangle beam: tip at origin, 200px long, 40px wide at end
          this.bgLayersGraphics.beginPath();
          this.bgLayersGraphics.moveTo(0, 0);
          this.bgLayersGraphics.lineTo(200, -20);
          this.bgLayersGraphics.lineTo(200, 20);
          this.bgLayersGraphics.closePath();
          this.bgLayersGraphics.fillPath();
          this.bgLayersGraphics.restore();

        }

        private drawShip(x: number, y: number, health: number, isSinking: boolean, sinkProg: number, time: number) {
          this.shipGraphics.clear();

          const alpha = isSinking ? Math.max(0.2, 1 - sinkProg * 0.8) : 1;
          const sinkOffset = isSinking ? sinkProg * 60 : 0;
          // Listing increases with damage
          const damageList = health < 40 ? (40 - health) / 40 * 0.18 : 0;
          const tilt = isSinking ? sinkProg * 0.4 : damageList;
          const rock = Math.sin(time * 1.2) * 0.05;

          // Glow halos
          const store = storeRef.current;
          const isActive = this.gamePhase === 'active';
          if (isActive && this.unrealizedPnl > 0) {
            this.shipGraphics.fillStyle(0x00d4ff, 0.06);
            this.shipGraphics.fillCircle(x, y + sinkOffset, 80);
            this.shipGraphics.fillStyle(0x00d4ff, 0.04);
            this.shipGraphics.fillCircle(x, y + sinkOffset, 100);
          }
          if (health < 30) {
            const pulse = (Math.sin(time * 3) + 1) * 0.5;
            this.shipGraphics.fillStyle(0xff0000, 0.04 + pulse * 0.08);
            this.shipGraphics.fillCircle(x, y + sinkOffset, 80 + pulse * 20);
          }

          // Shadow on water
          this.shipGraphics.fillStyle(0x000000, 0.2);
          this.shipGraphics.fillEllipse(x, y + 32 + sinkOffset * 0.5, 140, 12);

          this.shipGraphics.save();
          this.shipGraphics.translateCanvas(x, y + sinkOffset);
          this.shipGraphics.rotateCanvas(tilt + rock);

          // Hull colors
          const hullColor = health > 60 ? 0x2a4a6b : health > 30 ? 0x4a3a1b : 0x4a1a1b;
          const superColor = health > 60 ? 0x3a5a7b : health > 30 ? 0x5a4a2b : 0x5a2a2b;
          const darkAccent = 0x1a2a3b;

          // --- Hull bottom ---
          this.shipGraphics.fillStyle(darkAccent, alpha);
          this.shipGraphics.fillRect(-65, 18, 130, 12);

          // --- Main hull body ---
          this.shipGraphics.fillStyle(hullColor, alpha);
          this.shipGraphics.fillRect(-70, 0, 140, 18);

          // --- Bow (front/right tapering) ---
          this.shipGraphics.fillTriangle(70, 0, 70, 18, 90, 9);
          this.shipGraphics.fillStyle(hullColor, alpha * 0.85);
          this.shipGraphics.fillTriangle(70, 0, 90, 9, 80, 0);

          // --- Stern (back/left) ---
          this.shipGraphics.fillStyle(hullColor, alpha);
          this.shipGraphics.fillTriangle(-70, 0, -70, 18, -80, 9);

          // --- Waterline stripe ---
          this.shipGraphics.lineStyle(1.5, 0x00d4ff, alpha * 0.7);
          this.shipGraphics.beginPath();
          this.shipGraphics.moveTo(-80, 9);
          this.shipGraphics.lineTo(90, 9);
          this.shipGraphics.strokePath();

          // --- Main deck ---
          this.shipGraphics.fillStyle(superColor, alpha);
          this.shipGraphics.fillRect(-65, -4, 130, 6);

          // --- Forward gun turret ---
          this.shipGraphics.fillStyle(darkAccent, alpha);
          this.shipGraphics.fillRect(-40, -10, 20, 8);
          // Barrel (pointing toward fortress, uses turretAngle)
          const barrelLen = 38;
          const barrelX = -20;
          const barrelY = -6;
          this.shipGraphics.save();
          this.shipGraphics.translateCanvas(barrelX, barrelY);
          this.shipGraphics.rotateCanvas(this.turretAngle);
          this.shipGraphics.fillStyle(0x1a1a2a, alpha);
          this.shipGraphics.fillRect(0, -2, barrelLen, 4);
          this.shipGraphics.restore();

          // --- Rear gun turret (smaller) ---
          this.shipGraphics.fillStyle(darkAccent, alpha);
          this.shipGraphics.fillRect(30, -8, 20, 6);
          this.shipGraphics.fillRect(50, -7, 20, 3.5);

          // --- Bridge/conning tower ---
          this.shipGraphics.fillStyle(superColor, alpha);
          this.shipGraphics.fillRect(-8, -28, 20, 24);

          // Bridge windows
          this.shipGraphics.fillStyle(0x00d4ff, alpha * 0.8);
          this.shipGraphics.fillRect(-4, -24, 5, 4);
          this.shipGraphics.fillRect(3, -24, 5, 4);
          this.shipGraphics.fillRect(10, -24, 5, 4);

          // Radar dish (small circle at top of bridge)
          this.shipGraphics.fillStyle(0x888888, alpha * 0.8);
          this.shipGraphics.fillCircle(2, -30, 4);

          // --- Smokestack ---
          this.shipGraphics.fillStyle(darkAccent, alpha);
          this.shipGraphics.fillRect(0, -22, 8, 14);

          // --- Mast ---
          this.shipGraphics.lineStyle(1, 0x888888, alpha * 0.8);
          this.shipGraphics.beginPath();
          this.shipGraphics.moveTo(-5, -45);
          this.shipGraphics.lineTo(-5, -28);
          this.shipGraphics.strokePath();

          // --- Flag (animated with time) ---
          this.shipGraphics.lineStyle(1, 0x00d4ff, alpha * 0.8);
          this.shipGraphics.beginPath();
          this.shipGraphics.moveTo(-5, -45);
          this.shipGraphics.lineTo(-5 + Math.sin(time * 3) * 3 + 10, -42);
          this.shipGraphics.lineTo(-5 + Math.sin(time * 3 + 1) * 3 + 8, -38);
          this.shipGraphics.lineTo(-5, -38);
          this.shipGraphics.strokePath();
          this.shipGraphics.fillStyle(0xffd700, alpha * 0.8);
          this.shipGraphics.fillTriangle(-5, -45, -5 + 12, -41, -5, -38);

          // --- Running lights ---
          this.shipGraphics.fillStyle(0xff0000, alpha);
          this.shipGraphics.fillCircle(-80, 5, 2);
          this.shipGraphics.fillStyle(0x00ff00, alpha);
          this.shipGraphics.fillCircle(90, 5, 2);

          // --- Damage effects ---
          if (health < 70) {
            // Scorch marks
            this.shipGraphics.fillStyle(0x0a0a0a, alpha * 0.6);
            this.shipGraphics.fillRect(-30, 2, 12, 6);
            this.shipGraphics.fillRect(20, 5, 10, 5);
          }
          if (health < 40) {
            // Visible holes
            this.shipGraphics.fillStyle(0x000000, alpha * 0.9);
            this.shipGraphics.fillEllipse(-20, 8, 12, 8);
            this.shipGraphics.fillEllipse(30, 5, 10, 6);
          }
          if (health < 20) {
            // Deck flames
            const flameTime = time * 4;
            this.shipGraphics.fillStyle(0xff4400, alpha * (0.6 + Math.sin(flameTime) * 0.3));
            this.shipGraphics.fillTriangle(-15, -4, -10, -4, -12, -14);
            this.shipGraphics.fillStyle(0xffaa00, alpha * (0.5 + Math.sin(flameTime + 1) * 0.3));
            this.shipGraphics.fillTriangle(10, -4, 16, -4, 13, -16);
          }

          if (health < 50) {
            // Structural cracks radiating from damage points
            this.shipGraphics.lineStyle(1, 0x000000, alpha * 0.8);
            this.shipGraphics.beginPath();
            this.shipGraphics.moveTo(-20, 5);
            this.shipGraphics.lineTo(-28, -5);
            this.shipGraphics.lineTo(-22, -12);
            this.shipGraphics.strokePath();

            this.shipGraphics.beginPath();
            this.shipGraphics.moveTo(25, 3);
            this.shipGraphics.lineTo(32, 12);
            this.shipGraphics.strokePath();
          }
          if (health < 25) {
            // Deep structural fractures
            this.shipGraphics.lineStyle(1.5, 0x1a0000, alpha * 0.9);
            this.shipGraphics.beginPath();
            this.shipGraphics.moveTo(-40, -4);
            this.shipGraphics.lineTo(-35, 10);
            this.shipGraphics.lineTo(-28, 15);
            this.shipGraphics.strokePath();

            // Exposed hull interior (dark orange glow through cracks)
            this.shipGraphics.lineStyle(1, 0xff4400, alpha * (0.3 + Math.sin(time * 6) * 0.2));
            this.shipGraphics.beginPath();
            this.shipGraphics.moveTo(-20, 5);
            this.shipGraphics.lineTo(-28, -5);
            this.shipGraphics.strokePath();
          }

          this.shipGraphics.restore();

          // Emit smoke when damaged
          if (health < 50) {
            this.emitSmoke(x + 4, y - 22 + sinkOffset);
          }

          void store;
        }

        private drawFortress(x: number, y: number) {
          this.fortressGraphics.clear();

          const dmg = this.fortressDamage;
          const time = this.waveTime;

          // --- Island base ---
          // Rocky platform with jagged top
          const islandPts = [
            { x: x - 90, y: y + 68 },
            { x: x - 90, y: y + 55 },
            { x: x - 75, y: y + 50 },
            { x: x - 60, y: y + 52 },
            { x: x - 45, y: y + 48 },
            { x: x - 20, y: y + 50 },
            { x: x, y: y + 47 },
            { x: x + 20, y: y + 50 },
            { x: x + 45, y: y + 48 },
            { x: x + 65, y: y + 52 },
            { x: x + 80, y: y + 50 },
            { x: x + 90, y: y + 55 },
            { x: x + 90, y: y + 68 },
          ];
          this.fortressGraphics.fillStyle(0x141a22, 0.95);
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(islandPts[0].x, islandPts[0].y);
          for (const pt of islandPts.slice(1)) {
            this.fortressGraphics.lineTo(pt.x, pt.y);
          }
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();

          // Rock texture
          this.fortressGraphics.fillStyle(0x1a2030, 0.8);
          this.fortressGraphics.fillRect(x - 80, y + 50, 20, 8);
          this.fortressGraphics.fillRect(x + 40, y + 52, 15, 6);
          this.fortressGraphics.fillRect(x - 20, y + 54, 25, 5);

          // Waterline foam around island
          this.fortressGraphics.lineStyle(1, 0xffffff, 0.15);
          this.fortressGraphics.strokeEllipse(x, y + 62, 185, 20);

          // --- Angled buttresses ---
          this.fortressGraphics.fillStyle(0x121820, 0.95);
          // Left buttress (parallelogram)
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(x - 60, y + 48);
          this.fortressGraphics.lineTo(x - 55, y);
          this.fortressGraphics.lineTo(x - 42, y);
          this.fortressGraphics.lineTo(x - 48, y + 48);
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();
          // Right buttress
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(x + 60, y + 48);
          this.fortressGraphics.lineTo(x + 55, y);
          this.fortressGraphics.lineTo(x + 42, y);
          this.fortressGraphics.lineTo(x + 48, y + 48);
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();

          // --- Brutalist main block (angular hexagonal shape) ---
          const lean = dmg > 60 ? (dmg - 60) / 40 * 6 : 0;
          const mainPts = [
            { x: x - 50 + lean, y: y - 30 },
            { x: x - 45 + lean, y: y - 45 },
            { x: x - 20 + lean, y: y - 55 },
            { x: x + 20, y: y - 55 },
            { x: x + 45, y: y - 45 },
            { x: x + 50, y: y - 30 },
            { x: x + 50, y: y + 50 },
            { x: x - 50 + lean, y: y + 50 },
          ];
          this.fortressGraphics.fillStyle(0x1a2030, 0.95);
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(mainPts[0].x, mainPts[0].y);
          for (const pt of mainPts.slice(1)) {
            this.fortressGraphics.lineTo(pt.x, pt.y);
          }
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();

          // Metallic sheen — thin lighter strip at top
          this.fortressGraphics.fillStyle(0x2a3a4a, 0.4);
          this.fortressGraphics.fillRect(x - 48 + lean, y - 52, 96, 8);

          // --- Symbol label ---
          const symAlpha = dmg > 60
            ? 0.3 + Math.random() * 0.5  // flickering when damaged
            : 1.0;
          const pulseAlpha = symAlpha * (0.7 + 0.3 * Math.sin(time * 2));

          // Glow halo behind symbol (color matches asset category)
          this.fortressGraphics.fillStyle(this.symbolColorHex, 0.12 + 0.06 * Math.sin(time * 2));
          this.fortressGraphics.fillCircle(x + lean * 0.5, y + 10, 40);

          // Symbol display — update alpha/position to match damage & lean
          const symX = x + lean * 0.5;
          if (this.symbolLabel) {
            this.symbolLabel.setAlpha(pulseAlpha * 0.92);
            this.symbolLabel.setX(symX);
          }
          if (this.symbolImage) {
            this.symbolImage.setAlpha(pulseAlpha * 0.92);
            this.symbolImage.setX(symX);
          }

          // --- Cracks at damage thresholds ---
          if (dmg > 20) {
            this.fortressGraphics.lineStyle(1, 0x080c10, 0.9);
            this.fortressGraphics.beginPath();
            this.fortressGraphics.moveTo(x - 30 + lean, y - 30);
            this.fortressGraphics.lineTo(x - 25 + lean, y - 10);
            this.fortressGraphics.lineTo(x - 28 + lean, y + 5);
            this.fortressGraphics.strokePath();
          }
          if (dmg > 40) {
            // Chunks broken off corners
            this.fortressGraphics.fillStyle(0x080c10, 0.95);
            this.fortressGraphics.beginPath();
            this.fortressGraphics.moveTo(x - 50 + lean, y - 45);
            this.fortressGraphics.lineTo(x - 35 + lean, y - 55);
            this.fortressGraphics.lineTo(x - 30 + lean, y - 40);
            this.fortressGraphics.closePath();
            this.fortressGraphics.fillPath();

            this.fortressGraphics.lineStyle(1, 0x080c10, 0.9);
            this.fortressGraphics.beginPath();
            this.fortressGraphics.moveTo(x + 20, y - 10);
            this.fortressGraphics.lineTo(x + 15, y + 15);
            this.fortressGraphics.strokePath();
          }

          // --- Defense cannons (sides) ---
          if (dmg < 60) {
            this.fortressGraphics.fillStyle(0x0a1020, 0.9);
            // Left cannon
            this.fortressGraphics.fillRect(x - 75, y + 5, 28, 6);
            this.fortressGraphics.fillCircle(x - 60, y + 8, 5);
            // Right cannon
            this.fortressGraphics.fillRect(x + 47, y + 5, 28, 6);
            this.fortressGraphics.fillCircle(x + 60, y + 8, 5);
          }

          // --- Searchlights ---
          const profitable = this.gamePhase === 'active' && this.unrealizedPnl > 0;
          const sweepSpeed = profitable ? 1.5 : 0.6;
          const sweepColor = profitable ? 0xff8800 : 0xffff00;
          const lAngle = Math.sin(time * sweepSpeed) * 0.5 - 0.3;
          const rAngle = -Math.sin(time * sweepSpeed + 1) * 0.5 + 0.3;

          // Left searchlight
          this.fortressGraphics.save();
          this.fortressGraphics.translateCanvas(x - 45 + lean, y - 52);
          this.fortressGraphics.rotateCanvas(lAngle);
          this.fortressGraphics.fillStyle(sweepColor, 0.04);
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(0, 0);
          this.fortressGraphics.lineTo(-30, -120);
          this.fortressGraphics.lineTo(30, -120);
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();
          this.fortressGraphics.restore();

          // Right searchlight
          this.fortressGraphics.save();
          this.fortressGraphics.translateCanvas(x + 45, y - 52);
          this.fortressGraphics.rotateCanvas(rAngle);
          this.fortressGraphics.fillStyle(sweepColor, 0.04);
          this.fortressGraphics.beginPath();
          this.fortressGraphics.moveTo(0, 0);
          this.fortressGraphics.lineTo(-30, -120);
          this.fortressGraphics.lineTo(30, -120);
          this.fortressGraphics.closePath();
          this.fortressGraphics.fillPath();
          this.fortressGraphics.restore();

          // Muzzle flash on fortress cannons randomly when health < 50
          if (this.marginHealth < 50 && Math.random() < 0.005) {
            this.fortressGraphics.fillStyle(0xffff00, 0.9);
            this.fortressGraphics.fillCircle(x - 75, y + 8, 6);
          }

          // --- Fire on fortress at dmg > 80 ---
          if (dmg > 80) {
            this.emitFortressFire(x, y);
          }
        }

        private drawReflections(width: number, height: number, shipX: number, waterY: number, fortressX: number) {
          this.reflectionGraphics.clear();
          const time = this.waveTime;

          // Ship reflection: simplified mirrored hull below waterY
          const reflAlpha = 0.15;
          const reflColor = 0x1a3050;
          for (let row = 0; row < 20; row++) {
            const ry = waterY + row * 1.5;
            const distort = Math.sin(ry * 0.3 + time * 1.5) * 3;
            const shrinkFactor = 1 - row / 30;
            const w = 130 * shrinkFactor;
            this.reflectionGraphics.fillStyle(reflColor, reflAlpha * (1 - row / 20));
            this.reflectionGraphics.fillRect(shipX - w / 2 + distort, ry, w, 1.5);
          }

          // Fortress reflection
          const fortReflColor = 0x0e1420;
          for (let row = 0; row < 30; row++) {
            const ry = waterY + row * 1.5;
            const distort = Math.sin(ry * 0.2 + time * 1.2) * 4;
            const shrinkFactor = 1 - row / 40;
            const w = 100 * shrinkFactor;
            this.reflectionGraphics.fillStyle(fortReflColor, reflAlpha * (1 - row / 30));
            this.reflectionGraphics.fillRect(fortressX - w / 2 + distort, ry, w, 1.5);
          }

          void width;
        }

        private drawScanlines(width: number, height: number) {
          // Only draw every other frame for performance
          if (this.frameCount % 2 !== 0) return;
          this.scanlineGraphics.clear();
          this.scanlineGraphics.fillStyle(0x000000, 0.04);
          for (let sy = 0; sy < height; sy += 3) {
            this.scanlineGraphics.fillRect(0, sy, width, 1);
          }
        }

        private emitFortressFire(x: number, y: number) {
          if (Math.random() > 0.3) return;
          const spots = [
            { x: x - 50, y: y - 30 },
            { x: x + 50, y: y - 30 },
            { x: x, y: y - 40 },
          ];
          const spot = spots[Math.floor(Math.random() * spots.length)];
          this.fortressFireParticles.push({
            x: spot.x + (Math.random() - 0.5) * 10,
            y: spot.y,
            vx: (Math.random() - 0.5) * 1,
            vy: -1.5 - Math.random() * 1.5,
            life: 0.8,
          });
          if (this.fortressFireParticles.length > 40) {
            this.fortressFireParticles.shift();
          }
        }

        private drawWaves(width: number, height: number, time: number, priceHistory: number[]) {
          this.waveGraphics.clear();

          const waterY = height * 0.68;
          const chartTop = waterY;
          const chartBot = height - 26;
          const chartH   = chartBot - chartTop;

          const raw = priceHistory.length >= 2 ? priceHistory : Array(20).fill(65000);

          // --- Smoothing pass: 5-point moving average to remove sharp jumps ---
          const smooth = (arr: number[], w = 3): number[] =>
            arr.map((_, i) => {
              const s = Math.max(0, i - w);
              const e = Math.min(arr.length - 1, i + w);
              const slice = arr.slice(s, e + 1);
              return slice.reduce((a, b) => a + b, 0) / slice.length;
            });
          const prices = smooth(smooth(raw)); // two passes for extra silkiness

          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const priceRange = maxP - minP || Math.max(minP * 0.002, 1e-8);

          // Viewport centered on current price — scrolls as price moves
          const viewHalf = Math.max(priceRange * 0.6, Math.max(this.currentPrice, 1) * 0.008);
          const viewMin  = this.currentPrice - viewHalf;
          const viewMax  = this.currentPrice + viewHalf;

          // Publish viewport for drawPriceScale and drawPriceZones
          this.chartTopY    = chartTop;
          this.chartBotY    = chartBot;
          this.chartViewMin = viewMin;
          this.chartViewMax = viewMax;

          const priceToY = (p: number) =>
            chartBot - ((p - viewMin) / (viewMax - viewMin)) * chartH;

          // Subtle living ripple layered on top (storm-driven choppiness)
          const chopFactor = 1 + this.stormIntensity * 4;
          const ripple = (x: number) =>
            Math.sin(x * 0.03 + time * 1.2 * (1 + this.stormIntensity)) * 1.2 * chopFactor +
            Math.sin(x * 0.07 + time * 0.8) * 0.6 * chopFactor;

          // Sparse control points — clamp to chart bounds
          const ctrl: { x: number; y: number }[] = prices.map((p, i) => ({
            x: (i / (prices.length - 1)) * width,
            y: Math.min(chartBot, Math.max(chartTop, priceToY(p) + ripple((i / (prices.length - 1)) * width))),
          }));

          // --- Catmull-Rom spline: generate dense smooth pts from control points ---
          const spline: { x: number; y: number }[] = [];
          const steps = 12; // sub-steps between each control point
          for (let i = 0; i < ctrl.length - 1; i++) {
            const p0 = ctrl[Math.max(0, i - 1)];
            const p1 = ctrl[i];
            const p2 = ctrl[i + 1];
            const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
            for (let s = 0; s < steps; s++) {
              const t  = s / steps;
              const t2 = t * t;
              const t3 = t2 * t;
              const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3);
              const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3);
              spline.push({ x, y });
            }
          }
          spline.push(ctrl[ctrl.length - 1]);

          // Clamp interpolated points — spline can overshoot control points
          for (const pt of spline) {
            pt.y = Math.min(chartBot, Math.max(chartTop, pt.y));
          }

          // Store for hover detection
          this.splinePoints = spline;
          this.chartMinP = minP;
          this.chartMaxP = maxP;

          // --- 1. Solid water background ---
          this.waveGraphics.fillStyle(this.lightMode ? 0x1e6080 : 0x071828, 1);
          this.waveGraphics.fillRect(0, waterY, width, height - waterY);

          // --- 1b. Sea floor terrain — per-candle red/green by buy vs sell dominance ---
          {
            const vols = this.volumeHistory;
            const rawPrices = this.priceHistory;
            if (vols && vols.length >= 2) {
              const floorY = height - 20;
              const maxRockH = (floorY - waterY) * 0.35;
              const maxVol = Math.max(...vols) || 1;
              const nv = vols.length;

              // Control points: one per candle, height ∝ volume
              const ctrl = vols.map((v, i) => ({
                x: (i / (nv - 1)) * width,
                y: floorY - (v / maxVol) * maxRockH,
              }));

              // Store for hover lookup
              this.terrainCtrl = ctrl;

              // Build full Catmull-Rom spline, store each candle's segment separately
              const segSteps = 10;
              const segments: { x: number; y: number }[][] = [];
              for (let i = 0; i < ctrl.length - 1; i++) {
                const p0 = ctrl[Math.max(0, i - 1)];
                const p1 = ctrl[i];
                const p2 = ctrl[i + 1];
                const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
                const seg: { x: number; y: number }[] = [];
                for (let st = 0; st <= segSteps; st++) {
                  const t = st / segSteps, t2 = t * t, t3 = t2 * t;
                  seg.push({
                    x: 0.5 * ((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
                    y: 0.5 * ((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
                  });
                }
                segments.push(seg);
              }

              // Draw each segment with its own color based on candle direction
              for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                // Green = buying dominated (price closed higher), red = selling dominated
                const isUp = rawPrices[i + 1] >= rawPrices[i];
                const color = isUp ? 0x1a7a2a : 0x7a1a1a;

                this.waveGraphics.fillStyle(color, 0.85);
                this.waveGraphics.beginPath();
                this.waveGraphics.moveTo(seg[0].x, floorY);
                for (const pt of seg) this.waveGraphics.lineTo(pt.x, pt.y);
                this.waveGraphics.lineTo(seg[seg.length - 1].x, floorY);
                this.waveGraphics.closePath();
                this.waveGraphics.fillPath();

                // Edge line
                this.waveGraphics.lineStyle(1, color, 1.0);
                this.waveGraphics.beginPath();
                seg.forEach((pt, si) => si === 0 ? this.waveGraphics.moveTo(pt.x, pt.y) : this.waveGraphics.lineTo(pt.x, pt.y));
                this.waveGraphics.strokePath();
              }
            }
          }

          // --- 3. Water overlay (submerged effect) ---
          this.waveGraphics.fillStyle(this.lightMode ? 0x2980b9 : 0x0a2040, this.lightMode ? 0.35 : 0.72);
          this.waveGraphics.fillRect(0, waterY, width, height - waterY);

          // --- 4. Smooth price line ---
          for (let i = 1; i < spline.length; i++) {
            const p0 = spline[i - 1];
            const p1 = spline[i];
            const srcIdx = Math.floor((i / spline.length) * (raw.length - 1));
            const isUp = raw[Math.min(srcIdx + 1, raw.length - 1)] >= raw[srcIdx];
            const lineColor = isUp ? 0x00ff88 : 0xff4444;
            const aboveSurface = p0.y < waterY || p1.y < waterY;
            this.waveGraphics.lineStyle(aboveSurface ? 3 : 2, lineColor, aboveSurface ? 1 : 0.65);
            this.waveGraphics.beginPath();
            this.waveGraphics.moveTo(p0.x, p0.y);
            this.waveGraphics.lineTo(p1.x, p1.y);
            this.waveGraphics.strokePath();
          }

          // --- 5. Sea surface shimmer ---
          this.waveGraphics.lineStyle(1.5, 0x00d4ff, 0.35);
          this.waveGraphics.beginPath();
          for (let wx = 0; wx <= width; wx += 3) {
            const wy = waterY + Math.sin(wx * 0.05 + time * 1.2) * 2;
            if (wx === 0) this.waveGraphics.moveTo(wx, wy);
            else this.waveGraphics.lineTo(wx, wy);
          }
          this.waveGraphics.strokePath();

          // --- 6. Glowing dot at latest price ---
          const last = spline[spline.length - 1];
          const lastIsUp = raw[raw.length - 1] >= raw[raw.length - 2];
          const dotColor = lastIsUp ? 0x00ff88 : 0xff4444;
          const aboveSurface = last.y < waterY;
          this.waveGraphics.fillStyle(dotColor, aboveSurface ? 0.4 : 0.2);
          this.waveGraphics.fillCircle(last.x, last.y, 7);
          this.waveGraphics.fillStyle(dotColor, aboveSurface ? 1 : 0.6);
          this.waveGraphics.fillCircle(last.x, last.y, 3);
        }

        private drawPriceScale(width: number, height: number, priceHistory: number[], currentPrice: number) {
          this.priceScaleGraphics.clear();

          const waterY  = height * 0.68;
          const chartTop = this.chartTopY || waterY;
          const chartBot = this.chartBotY || (height - 26);
          const chartH   = chartBot - chartTop;
          const viewMin  = this.chartViewMin;
          const viewMax  = this.chartViewMax;
          const viewRange = (viewMax - viewMin) || 1;

          // Same formulas as drawWaves
          const priceToY = (p: number) =>
            chartBot - ((p - viewMin) / viewRange) * chartH;
          const yToPrice = (y: number) =>
            viewMin + ((chartBot - y) / chartH) * viewRange;

          const axisX = width - 8;

          // ── Vertical axis line: sea surface → sea floor ──
          this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.8);
          this.priceScaleGraphics.beginPath();
          this.priceScaleGraphics.moveTo(axisX, chartTop);
          this.priceScaleGraphics.lineTo(axisX, chartBot);
          this.priceScaleGraphics.strokePath();

          // ── 6 price ticks evenly spaced from chartTop to chartBot ──
          for (let i = 0; i < 6; i++) {
            const tickY = chartTop + (i / 5) * chartH;
            const tickPrice = yToPrice(tickY);

            // Tick mark
            this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.7);
            this.priceScaleGraphics.beginPath();
            this.priceScaleGraphics.moveTo(axisX - 4, tickY);
            this.priceScaleGraphics.lineTo(axisX, tickY);
            this.priceScaleGraphics.strokePath();

            // Subtle horizontal grid line
            this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.12);
            this.priceScaleGraphics.beginPath();
            this.priceScaleGraphics.moveTo(0, tickY);
            this.priceScaleGraphics.lineTo(axisX - 4, tickY);
            this.priceScaleGraphics.strokePath();

            const label = this.priceScaleLabels[i];
            if (label) {
              label.setText(this.fmtPrice(tickPrice));
              label.setPosition(axisX - 6, tickY);
            }
          }

          // ── Current price marker ──
          const prices = priceHistory.length >= 2 ? priceHistory : [currentPrice];
          const curY = Math.max(chartTop, Math.min(chartBot, priceToY(currentPrice)));
          const isUp = currentPrice >= prices[prices.length - 2];
          const markerColor = isUp ? 0x00cc44 : 0xff3333;
          const markerHex  = isUp ? '#00cc44' : '#ff3333';

          // Triangle pointer on axis
          this.priceScaleGraphics.fillStyle(markerColor, 1);
          this.priceScaleGraphics.beginPath();
          this.priceScaleGraphics.moveTo(axisX + 4, curY);
          this.priceScaleGraphics.lineTo(axisX - 6, curY - 7);
          this.priceScaleGraphics.lineTo(axisX - 6, curY + 7);
          this.priceScaleGraphics.closePath();
          this.priceScaleGraphics.fillPath();

          // Current price badge
          if (this.currentPriceLabel) {
            this.currentPriceLabel.setFontSize('11px');
            this.currentPriceLabel.setText(this.fmtPrice(currentPrice));
            this.currentPriceLabel.setPosition(axisX - 4, curY);
            this.currentPriceLabel.setColor('#ffffff');
            this.currentPriceLabel.setBackgroundColor(markerHex);
          }

          // ── Time axis at sea floor ──
          const timeAxisY = height - 2;
          const timestamps = this.priceTimestamps;
          const n = timestamps.length;

          // Horizontal axis line along sea floor
          this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.6);
          this.priceScaleGraphics.beginPath();
          this.priceScaleGraphics.moveTo(0, timeAxisY);
          this.priceScaleGraphics.lineTo(width, timeAxisY);
          this.priceScaleGraphics.strokePath();

          // Hide all labels first, then show the ones that fit
          for (const lbl of this.timeTickLabels) lbl.setVisible(false);

          // Minimum px between label centres — wide enough that labels never overlap.
          // Each label is at most ~45px wide at the 9px font size used below.
          const minLabelSpacing = 64;
          let lastLabelX = -minLabelSpacing;
          let labelIdx = 0;

          const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

          for (let i = 0; i < n; i++) {
            const tickX = n > 1 ? (i / (n - 1)) * width : 0;
            const ts = timestamps[i];

            // Only draw tick marks at label positions to reduce visual noise
            if (ts && tickX - lastLabelX >= minLabelSpacing && labelIdx < this.timeTickLabels.length) {
              // Tick mark
              this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.85);
              this.priceScaleGraphics.beginPath();
              this.priceScaleGraphics.moveTo(tickX, timeAxisY);
              this.priceScaleGraphics.lineTo(tickX, timeAxisY - 6);
              this.priceScaleGraphics.strokePath();

              const d = new Date(ts);
              const h24 = d.getHours();
              const h12 = h24 % 12 || 12;
              const ampm = h24 < 12 ? 'AM' : 'PM';
              const mm = d.getMinutes().toString().padStart(2, '0');
              let labelText: string;
              if (this.timeframe === '60m') {
                // For hourly candles, show day so context is visible across multiple days
                labelText = `${DAY_ABBR[d.getDay()]} ${h12}${ampm}`;
              } else {
                labelText = `${h12}:${mm}${ampm}`;
              }

              const lbl = this.timeTickLabels[labelIdx++];
              lbl.setText(labelText);
              lbl.setPosition(tickX, timeAxisY - 16);
              lbl.setVisible(true);
              lastLabelX = tickX;
            }
          }
        }

        private drawHover(width: number, height: number) {
          this.hoverGraphics.clear();

          const waterY = height * 0.68;

          // Determine active X: pinned takes priority, otherwise only show in sea area
          let activeX: number;
          if (this.hoverPinned && this.pinnedX >= 0) {
            activeX = this.pinnedX;
          } else if (this.hoverX >= 0 && this.hoverY > waterY) {
            activeX = this.hoverX;
          } else {
            this.hoverPriceLabel.setVisible(false);
            this.hoverTimeLabel.setVisible(false);
            this.hoverVolumeLabel.setVisible(false);
            return;
          }

          if (this.splinePoints.length === 0) {
            this.hoverPriceLabel.setVisible(false);
            this.hoverTimeLabel.setVisible(false);
            this.hoverVolumeLabel.setVisible(false);
            return;
          }

          // Find nearest spline point to activeX
          let nearest = this.splinePoints[0];
          let minDist = Infinity;
          for (const pt of this.splinePoints) {
            const d = Math.abs(pt.x - activeX);
            if (d < minDist) { minDist = d; nearest = pt; }
          }

          // Interpolate the raw (unsmoothed) price at activeX
          const raw = this.priceHistory;
          const n = raw.length;
          const t = Math.max(0, Math.min(1, activeX / width));
          const fi = t * (n - 1);
          const lo = Math.floor(fi);
          const hi = Math.min(n - 1, lo + 1);
          const price = raw[lo] + (fi - lo) * (raw[hi] - raw[lo]);

          // Corresponding timestamp
          const ts = this.priceTimestamps[Math.round(t * (this.priceTimestamps.length - 1))];

          // Vertical dashed crosshair line (water surface → sea floor)
          this.hoverGraphics.lineStyle(1, 0x00d4ff, 0.25);
          for (let dy = waterY; dy < height; dy += 8) {
            this.hoverGraphics.beginPath();
            this.hoverGraphics.moveTo(nearest.x, dy);
            this.hoverGraphics.lineTo(nearest.x, Math.min(dy + 4, height));
            this.hoverGraphics.strokePath();
          }

          // Outer glow ring (brighter when pinned)
          this.hoverGraphics.lineStyle(3, 0x00d4ff, this.hoverPinned ? 0.6 : 0.2);
          this.hoverGraphics.strokeCircle(nearest.x, nearest.y, 8);
          // Pinned: extra outer ring
          if (this.hoverPinned) {
            this.hoverGraphics.lineStyle(1.5, 0xffd700, 0.7);
            this.hoverGraphics.strokeCircle(nearest.x, nearest.y, 12);
          }
          // Inner filled dot
          this.hoverGraphics.fillStyle(0x00d4ff, 1);
          this.hoverGraphics.fillCircle(nearest.x, nearest.y, 4);
          // White centre pinpoint
          this.hoverGraphics.fillStyle(0xffffff, 1);
          this.hoverGraphics.fillCircle(nearest.x, nearest.y, 1.5);

          // Price label — keep inside canvas bounds
          const labelText = this.fmtPrice(price);
          const labelOffX = nearest.x + 10 > width - 75 ? -10 : 10;
          const labelOriginX = labelOffX > 0 ? 0 : 1;
          const labelY = Math.max(waterY + 4, nearest.y - 16);
          this.hoverPriceLabel.setText(labelText);
          this.hoverPriceLabel.setOrigin(labelOriginX, 1);
          this.hoverPriceLabel.setPosition(nearest.x + labelOffX, labelY);
          this.hoverPriceLabel.setVisible(true);

          // Time label on the sea-floor axis
          if (ts) {
            const d = new Date(ts);
            const h24 = d.getHours();
            const h12 = h24 % 12 || 12;
            const ampm = h24 < 12 ? 'AM' : 'PM';
            const mm = d.getMinutes().toString().padStart(2, '0');
            this.hoverTimeLabel.setText(`${h12}:${mm} ${ampm}`);
            this.hoverTimeLabel.setPosition(nearest.x, height - 28);
            this.hoverTimeLabel.setVisible(true);
          }

          // Volume dot + label at terrain peak
          const volIdx = Math.round(t * (this.volumeHistory.length - 1));
          const vol = this.volumeHistory[volIdx] ?? 0;
          if (vol > 0 && this.terrainCtrl.length > 0) {
            // Find nearest terrain ctrl point
            let nearestTerrain = this.terrainCtrl[0];
            for (const pt of this.terrainCtrl) {
              if (Math.abs(pt.x - activeX) < Math.abs(nearestTerrain.x - activeX)) nearestTerrain = pt;
            }

            // Dot at terrain peak
            const isUp = volIdx === 0 ? true : this.priceHistory[volIdx] >= this.priceHistory[volIdx - 1];
            const dotColor = isUp ? 0x2eb83a : 0xb83a2e;
            this.hoverGraphics.fillStyle(dotColor, 1);
            this.hoverGraphics.fillCircle(nearestTerrain.x, nearestTerrain.y, 3.5);
            this.hoverGraphics.lineStyle(1.5, dotColor, 0.5);
            this.hoverGraphics.strokeCircle(nearestTerrain.x, nearestTerrain.y, 6);

            // Format volume: e.g. 1.4M, 320K
            const volText = vol >= 1_000_000
              ? `VOL ${(vol / 1_000_000).toFixed(2)}M`
              : vol >= 1_000
              ? `VOL ${(vol / 1_000).toFixed(0)}K`
              : `VOL ${vol.toFixed(0)}`;

            this.hoverVolumeLabel.setText(volText);
            this.hoverVolumeLabel.setStyle({ color: isUp ? '#44dd66' : '#dd4444' });
            this.hoverVolumeLabel.setPosition(nearestTerrain.x, nearestTerrain.y - 5);
            this.hoverVolumeLabel.setVisible(true);
          } else {
            this.hoverVolumeLabel.setVisible(false);
          }
        }

        private drawPriceZones(width: number, height: number) {
          this.overlayGraphics.clear();

          if (!this.positionSide || this.entryPrice <= 0) {
            this.liqExplosionLabel?.setVisible(false);
            return;
          }

          const chartBot  = this.chartBotY || (height - 26);
          const chartH    = chartBot - (this.chartTopY || height * 0.68);
          const viewRange = (this.chartViewMax - this.chartViewMin) || 1;

          const priceToY = (price: number) =>
            chartBot - ((price - this.chartViewMin) / viewRange) * chartH;

          const entryY = priceToY(this.entryPrice);
          const liqY = this.liquidationPrice > 0 ? priceToY(this.liquidationPrice) : 0;

          // Only show 💥 when hull is getting critical (< 40% health)
          if (liqY > 0 && this.marginHealth < 40) {
            const danger = 1 - this.marginHealth / 40; // 0→1 as health drops 40→0
            const pulse = 0.5 + 0.5 * Math.sin(this.waveTime * (4 + danger * 6));
            const scale = 0.8 + 0.4 * danger + 0.2 * pulse;
            this.liqExplosionLabel
              .setPosition(width - 22, liqY)
              .setScale(scale)
              .setAlpha(0.5 + 0.5 * pulse)
              .setVisible(true);
          } else {
            this.liqExplosionLabel.setVisible(false);
          }

          // Entry dot — position on x-axis via linear interpolation over timestamp span
          const timestamps = this.priceTimestamps;
          const n = timestamps.length;
          if (n >= 2 && this.entryTimestamp > 0) {
            const oldest = timestamps[0];
            const newest = timestamps[n - 1];
            const span = newest - oldest;
            const t = span > 0
              ? Math.max(0, Math.min(1, (this.entryTimestamp - oldest) / span))
              : 1;
            const dotX = t * width;
            const dotColor = this.positionSide === 'long' ? 0x00ff88 : 0xff3333;
            this.overlayGraphics.fillStyle(dotColor, 1);
            this.overlayGraphics.fillCircle(dotX, entryY, 5);
          }

        }

        private drawCrosshair(x: number, y: number, time: number) {
          this.crosshairGraphics.clear();

          if (this.gamePhase !== 'aiming' && this.gamePhase !== 'firing') return;

          const size = 50;
          const bracketLen = 14;
          const progress = Math.min(1, this.crosshairProgress);
          const offset = (1 - progress) * 25;

          const isFlashing = this.gamePhase === 'firing';
          const flashAlpha = isFlashing ? (Math.sin(time * 15) > 0 ? 0.9 : 0.0) : 1.0;
          const color = isFlashing ? 0xff3333 : 0x00ff88;

          if (isFlashing && Math.sin(time * 15) <= 0) return;

          this.crosshairGraphics.lineStyle(2, color, flashAlpha);

          const tlx = x - size - offset;
          const tly = y - size - offset;
          this.crosshairGraphics.beginPath();
          this.crosshairGraphics.moveTo(tlx, tly + bracketLen);
          this.crosshairGraphics.lineTo(tlx, tly);
          this.crosshairGraphics.lineTo(tlx + bracketLen, tly);
          this.crosshairGraphics.strokePath();

          const trx = x + size + offset;
          this.crosshairGraphics.beginPath();
          this.crosshairGraphics.moveTo(trx - bracketLen, tly);
          this.crosshairGraphics.lineTo(trx, tly);
          this.crosshairGraphics.lineTo(trx, tly + bracketLen);
          this.crosshairGraphics.strokePath();

          const bly = y + size + offset;
          this.crosshairGraphics.beginPath();
          this.crosshairGraphics.moveTo(tlx, bly - bracketLen);
          this.crosshairGraphics.lineTo(tlx, bly);
          this.crosshairGraphics.lineTo(tlx + bracketLen, bly);
          this.crosshairGraphics.strokePath();

          this.crosshairGraphics.beginPath();
          this.crosshairGraphics.moveTo(trx - bracketLen, bly);
          this.crosshairGraphics.lineTo(trx, bly);
          this.crosshairGraphics.lineTo(trx, bly - bracketLen);
          this.crosshairGraphics.strokePath();

          const ringR = size + offset + 12;
          const dashCount = 12;
          const rotOffset = time * 1.5;
          this.crosshairGraphics.lineStyle(1, color, flashAlpha * 0.5);
          for (let d = 0; d < dashCount; d++) {
            const a1 = (d / dashCount) * Math.PI * 2 + rotOffset;
            const a2 = a1 + (Math.PI * 2 / dashCount) * 0.5;
            this.crosshairGraphics.beginPath();
            this.crosshairGraphics.moveTo(x + Math.cos(a1) * ringR, y + Math.sin(a1) * ringR);
            this.crosshairGraphics.lineTo(x + Math.cos(a2) * ringR, y + Math.sin(a2) * ringR);
            this.crosshairGraphics.strokePath();
          }

          const pulseR = 3 + Math.sin(time * 4) * 1.5;
          this.crosshairGraphics.fillStyle(color, flashAlpha * 0.9);
          this.crosshairGraphics.fillCircle(x, y, pulseR);

          if (progress >= 0.9 && this.gamePhase === 'aiming') {
            this.crosshairGraphics.fillStyle(0x000000, 0.6);
            this.crosshairGraphics.fillRect(x - 48, y + size + offset + 6, 96, 14);
            this.crosshairGraphics.fillStyle(0x00ff88, Math.min(1, (progress - 0.9) * 10));
          }
        }

        private drawHealthBar(x: number, y: number, health: number) {
          this.healthBarGraphics.clear();

          this.healthBarGraphics.fillStyle(0x000000, 0.7);
          this.healthBarGraphics.fillRect(x - 52, y - 2, 104, 14);

          this.healthBarGraphics.lineStyle(1, 0x00d4ff, 0.8);
          this.healthBarGraphics.strokeRect(x - 52, y - 2, 104, 14);

          const barColor = health > 60 ? 0x00ff88 : health > 30 ? 0xffd700 : 0xff3333;
          const barWidth = Math.max(0, (health / 100) * 100);
          this.healthBarGraphics.fillStyle(barColor, 0.9);
          this.healthBarGraphics.fillRect(x - 51, y - 1, barWidth, 12);

          this.healthBarGraphics.lineStyle(1, 0x000000, 0.5);
          for (let i = 1; i < 10; i++) {
            this.healthBarGraphics.beginPath();
            this.healthBarGraphics.moveTo(x - 51 + i * 10, y - 1);
            this.healthBarGraphics.lineTo(x - 51 + i * 10, y + 11);
            this.healthBarGraphics.strokePath();
          }
        }

        private emitSmoke(x: number, y: number) {
          if (Math.random() > 0.15) return;
          this.smokeParticles.push({
            x: x + (Math.random() - 0.5) * 10,
            y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -1 - Math.random(),
            life: 1.0,
            size: 3 + Math.random() * 5,
          });
          if (this.smokeParticles.length > 30) {
            this.smokeParticles.shift();
          }
        }

        private emitWake(x: number, y: number, speed: number) {
          if (Math.random() > 0.4) return;
          const size = 3 + Math.random() * 4 + speed * 2;
          this.wakeParticles.push({
            x: x - 72 + (Math.random() - 0.5) * 8,
            y: y + 8 + (Math.random() - 0.5) * 4,
            vx: -0.3 - Math.random() * 0.5,
            life: 1.0,
            size,
            alpha: 0.4 + speed * 0.1,
          });
          this.wakeParticles.push({
            x: x - 82 - Math.random() * 15,
            y: y + 8 + (Math.random() - 0.5) * 3,
            vx: -0.5 - Math.random() * 0.8,
            life: 0.8,
            size: size * 0.7,
            alpha: 0.25,
          });
          if (this.wakeParticles.length > 60) this.wakeParticles.shift();
        }

        private emitSparks(x: number, y: number) {
          if (Math.random() > 0.08) return;
          for (let i = 0; i < 3; i++) {
            this.sparkParticles.push({
              x: x + (Math.random() - 0.5) * 30,
              y: y + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 3,
              vy: -1 - Math.random() * 2,
              life: 0.5 + Math.random() * 0.3,
            });
          }
          if (this.sparkParticles.length > 50) this.sparkParticles.splice(0, 20);
        }

        private spawnFloatingText(text: string, x: number, y: number, color: number) {
          const { width } = this.scale;
          const clampX = Math.max(40, Math.min(width - 40, x));
          const textObj = this.add.text(clampX, y, text, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 2,
          }).setOrigin(0.5, 0.5).setDepth(28);

          this.floatingTexts.push({
            obj: textObj,
            vy: -1.2,
            life: 1.0,
            maxLife: 1.0,
          });

          if (this.floatingTexts.length > 15) {
            const old = this.floatingTexts.shift();
            if (old) old.obj.destroy();
          }
        }

        private updateFloatingTexts() {
          this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.obj.y += ft.vy;
            ft.life -= 0.016;
            ft.obj.setAlpha(ft.life / ft.maxLife);
            if (ft.life <= 0) {
              ft.obj.destroy();
              return false;
            }
            return true;
          });
        }

        private updateSmoke() {
          this.particleGraphics.clear();

          this.smokeParticles = this.smokeParticles.filter(p => p.life > 0);
          this.smokeParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            p.size += 0.1;
            this.particleGraphics.fillStyle(0x888888, p.life * 0.5);
            this.particleGraphics.fillCircle(p.x, p.y, p.size);
          });

          // Water particles
          this.waterParticles = this.waterParticles.filter(p => p.life > 0);
          this.waterParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.03;
            this.particleGraphics.fillStyle(0x00d4ff, p.life * 0.8);
            this.particleGraphics.fillCircle(p.x, p.y, p.size);
          });

          // Explosion particles
          this.explosionParticles = this.explosionParticles.filter(p => p.life > 0);
          this.explosionParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= 0.02;
            this.particleGraphics.fillStyle(p.color, p.life);
            this.particleGraphics.fillCircle(p.x, p.y, 3 * p.life);
          });

          // Fortress fire particles
          this.fortressFireParticles = this.fortressFireParticles.filter(p => p.life > 0);
          this.fortressFireParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.025;
            const fireColor = p.life > 0.5 ? 0xffaa00 : 0xff4400;
            this.particleGraphics.fillStyle(fireColor, p.life * 0.9);
            this.particleGraphics.fillCircle(p.x, p.y, 3 + p.life * 3);
          });

          // Shockwave rings
          this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);
          this.shockwaves.forEach(sw => {
            sw.radius += sw.maxRadius * 0.05;
            sw.life -= 0.04;
            this.particleGraphics.lineStyle(2, 0xff8800, sw.life * 0.8);
            this.particleGraphics.strokeCircle(sw.x, sw.y, sw.radius);
          });

          // Debris chunks
          this.debrisParticles = this.debrisParticles.filter(d => d.life > 0);
          this.debrisParticles.forEach(d => {
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.2; // gravity
            d.life -= 0.02;
            this.particleGraphics.fillStyle(d.color, d.life * 0.9);
            this.particleGraphics.fillRect(d.x, d.y, d.w, d.h);
          });


          // Spark particles
          this.sparkParticles = this.sparkParticles.filter(p => p.life > 0);
          this.sparkParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= 0.04;
            const sparkColor = p.life > 0.3 ? 0xffff00 : 0xff8800;
            this.particleGraphics.fillStyle(sparkColor, p.life * 1.5);
            this.particleGraphics.fillCircle(p.x, p.y, 1.5 + p.life);
          });

          // Coin particles (win celebration)
          this.celebrationGraphics.clear();
          this.coinParticles = this.coinParticles.filter(p => p.life > 0);
          this.coinParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12; // gravity
            p.vx *= 0.99;
            p.life -= 0.015;
            p.rot += p.rotSpeed;
            this.celebrationGraphics.fillStyle(p.color, p.life * 0.9);
            this.celebrationGraphics.save();
            this.celebrationGraphics.translateCanvas(p.x, p.y);
            this.celebrationGraphics.rotateCanvas(p.rot);
            this.celebrationGraphics.fillEllipse(0, 0, 8, 5);
            this.celebrationGraphics.restore();
          });
        }

        private fireCannon() {
          const { width } = this.scale;
          const shipX = width * 0.2;
          const fortressX = width * 0.75;

          // Recoil tween on turret angle then spring forward
          const originalAngle = this.turretAngle;
          const recoilAngle = originalAngle + 0.15;
          this.turretAngle = recoilAngle;
          this.tweens.add({
            targets: this,
            turretAngle: originalAngle,
            duration: 250,
            ease: 'Back.easeOut',
          });

          const trailPositions: { x: number; y: number }[] = [];
          const maxTrail = 8;

          const cannonBall = this.add.graphics();
          cannonBall.fillStyle(0xffff00, 1);
          cannonBall.fillCircle(0, 0, 5);
          cannonBall.x = shipX + 55;
          cannonBall.y = this.shipY - 5;
          cannonBall.setDepth(20);

          const trailGraphics = this.add.graphics();
          trailGraphics.setDepth(19);

          // Barrel smoke — 5 particles from barrel tip
          for (let i = 0; i < 5; i++) {
            this.smokeParticles.push({
              x: shipX + 55 + (Math.random() - 0.5) * 8,
              y: this.shipY - 5 + (Math.random() - 0.5) * 4,
              vx: 1 + Math.random() * 2,
              vy: -1 - Math.random() * 1.5,
              life: 0.8,
              size: 4 + Math.random() * 4,
            });
          }

          // Muzzle flash
          const flash = this.add.graphics();
          flash.fillStyle(0xffff00, 0.9);
          flash.fillCircle(0, 0, 12);
          flash.x = shipX + 55;
          flash.y = this.shipY - 5;
          flash.setDepth(21);

          this.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 3,
            scaleY: 3,
            duration: 200,
            onComplete: () => flash.destroy(),
          });

          // Increment fortress damage
          this.fortressDamage = Math.min(100, this.fortressDamage + 15);

          // Floating text: +HIT at fortress
          setTimeout(() => {
            this.spawnFloatingText('+HIT', fortressX + (Math.random() - 0.5) * 30, this.shipY - 30, 0xff8800);
          }, 800);

          // Water splash at impact
          const createSplash = () => {
            for (let i = 0; i < 12; i++) {
              this.waterParticles.push({
                x: fortressX + (Math.random() - 0.5) * 30,
                y: this.shipY + 10,
                vx: (Math.random() - 0.5) * 4,
                vy: -4 - Math.random() * 4,
                life: 1.0,
                size: 2 + Math.random() * 3,
              });
            }
            // Shockwave ring
            this.shockwaves.push({
              x: fortressX,
              y: this.shipY - 30,
              radius: 10,
              maxRadius: 60,
              life: 1.0,
            });
            // Fire burst particles
            for (let i = 0; i < 10; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 2 + Math.random() * 4;
              this.explosionParticles.push({
                x: fortressX,
                y: this.shipY - 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 0.8,
                color: Math.random() > 0.5 ? 0xffaa00 : 0xff4400,
              });
            }
            // Debris chunks
            for (let i = 0; i < 6; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.5 + Math.random() * 3;
              this.debrisParticles.push({
                x: fortressX,
                y: this.shipY - 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: 1.0,
                w: 4 + Math.random() * 6,
                h: 3 + Math.random() * 4,
                color: 0x3a2a10,
              });
            }
          };

          const startX = shipX + 55;
          const startY = this.shipY - 5;
          const endX = fortressX;
          const endY = this.shipY - 30;
          const arcHeight = 80;
          const duration = 800;
          const startTime = this.time.now;

          const updateBall = () => {
            const elapsed = this.time.now - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Parabolic arc: y offset = -arcHeight * 4 * t * (1 - t)
            cannonBall.x = startX + (endX - startX) * progress;
            cannonBall.y = startY + (endY - startY) * progress - arcHeight * 4 * progress * (1 - progress);

            // trail
            trailPositions.unshift({ x: cannonBall.x, y: cannonBall.y });
            if (trailPositions.length > maxTrail) trailPositions.pop();
            trailGraphics.clear();
            trailPositions.forEach((tp, idx) => {
              const trailAlpha = 0.8 * (1 - idx / maxTrail);
              const trailRadius = 4 * (1 - idx / maxTrail);
              const trailColor = idx < maxTrail / 2 ? 0xffaa00 : 0xff4400;
              trailGraphics.fillStyle(trailColor, trailAlpha);
              trailGraphics.fillCircle(tp.x, tp.y, trailRadius);
            });

            if (progress >= 1) {
              this.events.off('update', updateBall);
              cannonBall.destroy();
              trailGraphics.destroy();
              createSplash();
              // impact flash
              const impactFlash = this.add.graphics();
              impactFlash.fillStyle(0xff8800, 0.9);
              impactFlash.fillCircle(0, 0, 20);
              impactFlash.x = fortressX;
              impactFlash.y = this.shipY - 30;
              impactFlash.setDepth(22);
              this.tweens.add({ targets: impactFlash, alpha: 0, scaleX: 3, scaleY: 3, duration: 300, onComplete: () => impactFlash.destroy() });
              // screen flash
              const screenFlash = this.add.graphics();
              screenFlash.fillStyle(0xffffff, 0.25);
              screenFlash.fillRect(0, 0, this.scale.width, this.scale.height);
              screenFlash.setDepth(48);
              this.tweens.add({ targets: screenFlash, alpha: 0, duration: 200, onComplete: () => screenFlash.destroy() });
            }
          };
          this.events.on('update', updateBall);

          this.cameras.main.shake(200, 0.008);

          const store = storeRef.current;
          if (store.selectedSide && store.tradeSize) {
            const side = store.selectedSide;
            const sz = store.tradeSize;
            const textColor = side === 'long' ? 0x00ff88 : 0xff3333;
            const label = side === 'long' ? `LONG $${sz}` : `SHORT $${sz}`;
            this.spawnFloatingText(label, width * 0.2, this.shipY - 60, textColor);
          }
        }

        private fireTorpedo() {
          const { width } = this.scale;
          const torpedo = this.add.graphics();
          torpedo.fillStyle(0xff3333, 0.9);
          torpedo.fillRect(-20, -4, 40, 8);
          torpedo.fillTriangle(-20, -4, -20, 4, -30, 0);
          torpedo.x = width * 0.75;
          torpedo.y = this.shipY + 5;
          torpedo.setDepth(15);

          this.tweens.add({
            targets: torpedo,
            x: width * 0.2,
            duration: 1200,
            ease: 'Linear',
            onComplete: () => {
              torpedo.destroy();

              const dmgAmt = Math.floor(5 + Math.random() * 20);
              this.spawnFloatingText(`-$${dmgAmt}`, width * 0.2 + (Math.random() - 0.5) * 30, this.shipY - 20, 0xff3333);

              this.cameras.main.shake(300, 0.015);

              // Water splash
              for (let i = 0; i < 8; i++) {
                this.waterParticles.push({
                  x: width * 0.2 + (Math.random() - 0.5) * 20,
                  y: this.shipY + 10,
                  vx: (Math.random() - 0.5) * 5,
                  vy: -3 - Math.random() * 5,
                  life: 1.0,
                  size: 2 + Math.random() * 4,
                });
              }

              // Shockwave on ship
              this.shockwaves.push({
                x: width * 0.2,
                y: this.shipY,
                radius: 8,
                maxRadius: 50,
                life: 1.0,
              });

              // Fire burst at ship
              for (let i = 0; i < 10; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 3;
                this.explosionParticles.push({
                  x: width * 0.2,
                  y: this.shipY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed - 1.5,
                  life: 0.7,
                  color: Math.random() > 0.5 ? 0xffaa00 : 0xff4400,
                });
              }

              // Screen flash
              const screenFlash = this.add.graphics();
              screenFlash.fillStyle(0xffffff, 0.2);
              screenFlash.fillRect(0, 0, this.scale.width, this.scale.height);
              screenFlash.setDepth(48);
              this.tweens.add({
                targets: screenFlash,
                alpha: 0,
                duration: 250,
                onComplete: () => screenFlash.destroy(),
              });
            },
          });
        }

        private triggerSink() {
          this.isSinking = true;
          const { width } = this.scale;

          for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 8;
            this.explosionParticles.push({
              x: width * 0.2,
              y: this.shipY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 3,
              life: 1.0,
              color: [0xff4400, 0xff8800, 0xffff00, 0xff0000][Math.floor(Math.random() * 4)],
            });
          }

          this.cameras.main.shake(500, 0.025);
        }

        private triggerWinCelebration(pnl: number, width: number, height: number) {
          const shipX = width * 0.2;
          const coinColors = [0xffd700, 0xffcc00, 0xff8800, 0xffee44];
          for (let i = 0; i < 40; i++) {
            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI;
            const speed = 3 + Math.random() * 6;
            this.coinParticles.push({
              x: shipX + (Math.random() - 0.5) * 40,
              y: this.shipY - 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 2,
              life: 1.0,
              color: coinColors[Math.floor(Math.random() * coinColors.length)],
              rot: Math.random() * Math.PI * 2,
              rotSpeed: (Math.random() - 0.5) * 0.3,
            });
          }
          this.spawnFloatingText(`+$${pnl.toFixed(2)} VICTORY!`, width * 0.5, height * 0.4, 0xffd700);
          this.spawnFloatingText('TREASURE SECURED', width * 0.5, height * 0.4 + 24, 0x00ff88);
          const winFlash = this.add.graphics();
          winFlash.fillStyle(0xffd700, 0.2);
          winFlash.fillRect(0, 0, width, height);
          winFlash.setDepth(47);
          this.tweens.add({ targets: winFlash, alpha: 0, duration: 600, onComplete: () => winFlash.destroy() });
          this.cameras.main.shake(300, 0.006);
        }

        private triggerLossCelebration(pnl: number, width: number) {
          this.spawnFloatingText(`RETREAT! $${pnl.toFixed(2)}`, width * 0.5, this.shipY - 60, 0xff8800);
          const lossFlash = this.add.graphics();
          lossFlash.fillStyle(0xff0000, 0.15);
          lossFlash.fillRect(0, 0, width, this.scale.height);
          lossFlash.setDepth(47);
          this.tweens.add({ targets: lossFlash, alpha: 0, duration: 800, onComplete: () => lossFlash.destroy() });
        }

        update(time: number, delta: number) {
          const { width, height } = this.scale;
          this.waveTime += delta * 0.001;
          this.shipRockTime += delta * 0.001;
          this.frameCount++;

          const currentStore = storeRef.current;

          // Smooth storm intensity from volatility
          const rawVol = this.computeVolatility();
          this.stormIntensity += (rawVol - this.stormIntensity) * 0.01;

          // Animate crosshair progress when aiming
          if (this.gamePhase === 'aiming') {
            this.crosshairProgress = Math.min(1, this.crosshairProgress + delta * 0.002);
          }

          // Update turret angle toward fortress when idle/active (slowly reset)
          if (this.gamePhase === 'idle' || this.gamePhase === 'active') {
            this.turretAngle = this.turretAngle * 0.95; // slowly return to 0
          }

          // Draw sky background (each frame for dynamic color)
          this.drawBackground(width, height, this.marginHealth, this.gamePhase, this.unrealizedPnl, this.waveTime);

          // Draw parallax layers (stars, fog, cliffs, lighthouse, moon)
          this.drawParallaxLayers(width, height, this.waveTime, delta);

          // Draw weather effects
          this.drawWeather(width, height, this.waveTime);

          // Draw price zones overlay (before waves)
          this.drawPriceZones(width, height);

          // Draw waves
          this.drawWaves(width, height, this.waveTime, this.priceHistory);

          // Draw price scale (right axis)
          this.drawPriceScale(width, height, this.priceHistory, this.currentPrice);

          // Draw hover crosshair + dot
          this.drawHover(width, height);

          // Ship position with rocking
          const shipX = width * 0.2;
          const rockY = Math.sin(this.shipRockTime * 1.2) * 3;
          const rockX = Math.cos(this.shipRockTime * 0.8) * 1;

          // Handle sinking
          if (this.isSinking) {
            this.sinkProgress = Math.min(1, this.sinkProgress + delta * 0.0008);
          }

          // Draw ship
          this.drawShip(
            shipX + rockX,
            this.shipY + rockY,
            this.marginHealth,
            this.isSinking,
            this.sinkProgress,
            this.waveTime
          );

          // Emit sparks when hull is critically damaged
          if (this.marginHealth < 40) {
            this.emitSparks(shipX + rockX + (Math.random() - 0.5) * 60, this.shipY + rockY - 5);
          }

          // Draw fortress
          const fortressX = width * 0.75;
          const waterY = height * 0.68;
          const fortressY = waterY - 65;
          this.drawFortress(fortressX, fortressY);

          // Draw water reflections
          this.drawReflections(width, height, shipX, waterY, fortressX);

          // Draw crosshair over fortress when aiming/firing
          if (this.gamePhase === 'aiming' || this.gamePhase === 'firing') {
            this.drawCrosshair(fortressX, fortressY - 10, this.waveTime);
          } else {
            this.crosshairGraphics.clear();
          }

          // Draw health bar above ship
          this.drawHealthBar(shipX, this.shipY - 55 + rockY, this.marginHealth);

          // Update particles
          this.updateSmoke();
          this.updateFloatingTexts();

          // Draw CRT scanline overlay
          this.drawScanlines(width, height);

          // Sync store if available
          if (currentStore) {
            const pos = currentStore.position;
            if (pos) {
              this.marginHealth = pos.marginHealth;
            } else if (this.gamePhase === 'idle') {
              this.marginHealth = 100;
            }
          }
        }
      }

      // Clean up previous instance
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      const container = containerRef.current;
      if (!container) return;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: container,
        backgroundColor: '#0a1628',
        width: container.clientWidth || 800,
        height: container.clientHeight || 500,
        scene: BattleSceneImpl,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;
      phaserInstance = game;
    };

    initPhaser();

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Sync store state to Phaser
  useEffect(() => {
    if (!gameRef.current) return;
    const game = gameRef.current;

    game.events.emit('updateState', {
      currentPrice: store.currentPrice,
      priceHistory: store.priceHistory,
      priceTimestamps: store.priceTimestamps,
      volumeHistory: store.volumeHistory,
      marginHealth: store.position?.marginHealth ?? 100,
      gamePhase: store.gamePhase,
      unrealizedPnl: store.position?.unrealizedPnl ?? 0,
      combo: store.combo,
      entryPrice: store.position?.entryPrice ?? 0,
      positionSide: store.position?.side ?? null,
      liquidationPrice: store.position?.liquidationPrice ?? 0,
      openedAt: store.position?.openedAt ?? 0,
      timeframe: store.timeframe,
      lightMode: store.lightMode,
      selectedSymbol: store.selectedSymbol,
      symbolLogoUrl: logoUrlsRef.current[store.selectedSymbol] ?? null,
    });

    // Fire torpedo when price moves against position
    if (store.position) {
      const pos = store.position;
      const priceDiff = store.currentPrice - pos.entryPrice;
      const isAgainst = (pos.side === 'long' && priceDiff < -100) || (pos.side === 'short' && priceDiff > 100);
      if (isAgainst && Math.random() < 0.05) {
        game.events.emit('torpedo');
      }
    }
  }, [store.currentPrice, store.gamePhase, store.position, store.priceHistory, store.volumeHistory, store.combo, store.timeframe, store.lightMode, store.selectedSymbol]);

  return (
    <div
      ref={containerRef}
      id="game-container"
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
