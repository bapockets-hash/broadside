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

export default function BattleshipGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameRef = useRef<any>(null);
  const store = useGameStore();
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  });

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
        private btcSprite!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private priceScaleGraphics!: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private priceScaleLabels: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private currentPriceLabel!: any;

        private waveTime = 0;
        private shipRockTime = 0;
        private marginHealth = 100;
        private gamePhase = 'idle';
        private priceHistory: number[] = Array(20).fill(65000);
        private currentPrice = 65000;
        private shipY = 320;
        private isSinking = false;
        private sinkProgress = 0;
        private explosionParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];
        private unrealizedPnl = 0;
        private frameCount = 0;

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

        constructor() {
          super({ key: 'BattleScene' });
        }

        preload() {
          this.load.image('btc-logo', '/btc-logo.png');
        }

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
          this.shipY = height * 0.62;

          // Fortress graphics
          this.fortressGraphics = this.add.graphics();
          this.fortressGraphics.setDepth(8);

          // BTC logo sprite — centered on fortress body
          const waterY = height * 0.68;
          const fortressX = width * 0.75;
          const fortressY = waterY - 65;
          this.btcSprite = this.add.image(fortressX, fortressY + 10, 'btc-logo');
          this.btcSprite.setScale(0.6);
          this.btcSprite.setDepth(9);
          this.btcSprite.setAlpha(0.92);

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

          // Price scale axis
          this.priceScaleGraphics = this.add.graphics();
          this.priceScaleGraphics.setDepth(19);

          // 5 tick labels (evenly spaced across price range)
          for (let i = 0; i < 5; i++) {
            const label = this.add.text(0, 0, '', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#4a7a9b',
              stroke: '#000000',
              strokeThickness: 1,
            }).setOrigin(1, 0.5).setDepth(20);
            this.priceScaleLabels.push(label);
          }

          // Current price marker label (brighter)
          this.currentPriceLabel = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#00d4ff',
            backgroundColor: '#071828',
            padding: { x: 3, y: 1 },
            stroke: '#000000',
            strokeThickness: 1,
          }).setOrigin(1, 0.5).setDepth(21);

          // Price text (inside Phaser canvas — secondary display)
          this.priceText = this.add.text(width - 20, 20, '', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#00d4ff',
          }).setOrigin(1, 0).setDepth(10).setVisible(false);

          // Phase text
          this.phaseText = this.add.text(width / 2, 30, 'AWAITING ORDERS', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2,
          }).setOrigin(0.5, 0).setDepth(10);

          // PnL text
          this.pnlText = this.add.text(20, 60, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#00ff88',
            stroke: '#000000',
            strokeThickness: 2,
          }).setDepth(10);

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
            marginHealth: number;
            gamePhase: string;
            unrealizedPnl: number;
            combo: number;
            entryPrice: number;
            positionSide: 'long' | 'short' | null;
            liquidationPrice: number;
          }) => {
            this.currentPrice = state.currentPrice;
            this.priceHistory = state.priceHistory;
            this.marginHealth = state.marginHealth;
            this.unrealizedPnl = state.unrealizedPnl;
            this.entryPrice = state.entryPrice;
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

            this.priceText.setText(`$${state.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

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

        private drawBackground(width: number, height: number, health: number, phase: string, pnl: number, time: number) {
          this.bgGraphics.clear();

          // --- Sky gradient based on health/phase ---
          let topR = 10, topG = 20, topB = 40;
          let botR = 26, botG = 58, botB = 92;

          if (health < 40) {
            // Blood red — critical
            topR = 26; topG = 8; topB = 8;
            botR = 58; botG = 8; botB = 8;
          } else if (health < 70) {
            // Dark orange tint — warning
            topR = 26; topG = 16; topB = 32;
            botR = 58; botG = 26; botB = 16;
          } else if (phase === 'active' && pnl > 0) {
            // Deep green tint — profitable
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
        }

        private drawParallaxLayers(width: number, height: number, time: number, delta: number) {
          this.bgLayersGraphics.clear();
          const waterY = height * 0.68;

          // --- Twinkling stars ---
          for (const star of this.stars) {
            const alpha = star.baseAlpha * (0.5 + 0.5 * Math.sin(time * 2 + star.phase));
            this.bgLayersGraphics.fillStyle(0xffffff, alpha);
            const size = star.baseAlpha > 0.7 ? 1.5 : 1;
            this.bgLayersGraphics.fillCircle(star.x, star.y, size);
          }

          // --- Moon with glow halos ---
          const moonX = width * 0.82;
          const moonY = height * 0.12;
          // Outer halos
          this.bgLayersGraphics.fillStyle(0xffffff, 0.03);
          this.bgLayersGraphics.fillCircle(moonX, moonY, 50);
          this.bgLayersGraphics.fillStyle(0xffffff, 0.06);
          this.bgLayersGraphics.fillCircle(moonX, moonY, 35);
          this.bgLayersGraphics.fillStyle(0xffffff, 0.12);
          this.bgLayersGraphics.fillCircle(moonX, moonY, 25);
          // Moon body
          this.bgLayersGraphics.fillStyle(0xeeeedd, 0.95);
          this.bgLayersGraphics.fillCircle(moonX, moonY, 20);

          // --- Moon reflection on water ---
          for (let ry = waterY; ry < waterY + 80; ry += 2) {
            const dist = ry - waterY;
            const shimmerAlpha = 0.02 + 0.06 * Math.max(0, 1 - dist / 80) * (0.5 + 0.5 * Math.sin(ry * 0.3 + time * 1.5));
            const shimmerW = 20 - dist * 0.15;
            if (shimmerW > 1) {
              this.bgLayersGraphics.fillStyle(0xffffff, shimmerAlpha);
              this.bgLayersGraphics.fillRect(moonX - shimmerW / 2, ry, shimmerW, 2);
            }
          }

          // --- Left cliff silhouette ---
          const cliffColor = 0x1a2030;
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
          const lhX = width * 0.12;
          const lhY = waterY - 90;
          // Rocky island base
          this.bgLayersGraphics.fillStyle(0x1a1a24, 0.9);
          this.bgLayersGraphics.fillEllipse(lhX, waterY - 5, 40, 14);
          // Tower
          this.bgLayersGraphics.fillStyle(0xd0d0c0, 0.9);
          this.bgLayersGraphics.fillRect(lhX - 4, lhY, 8, 60);
          // Lantern house
          this.bgLayersGraphics.fillStyle(0xf0f0e0, 0.9);
          this.bgLayersGraphics.fillRect(lhX - 6, lhY - 10, 12, 10);
          // Lantern light
          this.bgLayersGraphics.fillStyle(0x00d4ff, 0.9);
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

          // --- Wake trail (behind stern) ---
          this.shipGraphics.fillStyle(0xffffff, 0.12);
          this.shipGraphics.fillRect(-80, 7, 12, 3);
          this.shipGraphics.fillStyle(0xffffff, 0.08);
          this.shipGraphics.fillRect(-95, 5, 16, 2);

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

          // --- BTC Symbol ---
          const btcAlpha = dmg > 60
            ? 0.3 + Math.random() * 0.5  // flickering when damaged
            : 1.0;
          const pulseAlpha = btcAlpha * (0.7 + 0.3 * Math.sin(time * 2));

          // Orange glow halo behind BTC symbol
          this.fortressGraphics.fillStyle(0xff6600, 0.12 + 0.06 * Math.sin(time * 2));
          this.fortressGraphics.fillCircle(x + lean * 0.5, y + 10, 40);

          // BTC logo sprite — update alpha/position to match damage & lean
          if (this.btcSprite) {
            this.btcSprite.setAlpha(pulseAlpha * 0.92);
            this.btcSprite.setX(x + lean * 0.5);
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
          const chartDepth = 55;
          const chartRise = 10;
          const totalRange = chartDepth + chartRise;

          const prices = priceHistory.length >= 2 ? priceHistory : Array(20).fill(65000);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const priceRange = maxP - minP || 100;

          const priceToY = (p: number) =>
            (waterY + chartDepth) - ((p - minP) / priceRange) * totalRange;

          const ripple = (x: number) =>
            Math.sin(x * 0.04 + time * 1.4) * 1.5 + Math.sin(x * 0.08 + time * 1.0) * 0.8;

          const pts: { x: number; y: number }[] = prices.map((p, i) => {
            const px = (i / (prices.length - 1)) * width;
            return { x: px, y: priceToY(p) + ripple(px) };
          });

          // Solid dark water background
          this.waveGraphics.fillStyle(0x071828, 1);
          this.waveGraphics.fillRect(0, waterY, width, height - waterY);

          // Colored fill from chart line to bottom
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const isUp = prices[i] >= prices[i - 1];
            this.waveGraphics.fillStyle(isUp ? 0x00ff88 : 0xff3333, 0.08);
            this.waveGraphics.beginPath();
            this.waveGraphics.moveTo(p0.x, p0.y);
            this.waveGraphics.lineTo(p1.x, p1.y);
            this.waveGraphics.lineTo(p1.x, height);
            this.waveGraphics.lineTo(p0.x, height);
            this.waveGraphics.closePath();
            this.waveGraphics.fillPath();
          }

          // Semi-transparent water overlay
          this.waveGraphics.fillStyle(0x0a2040, 0.72);
          this.waveGraphics.fillRect(0, waterY, width, height - waterY);

          // Price line
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1];
            const p1 = pts[i];
            const isUp = prices[i] >= prices[i - 1];
            const lineColor = isUp ? 0x00ff88 : 0xff4444;
            const aboveSurface = p0.y < waterY || p1.y < waterY;
            this.waveGraphics.lineStyle(aboveSurface ? 3 : 2, lineColor, aboveSurface ? 1 : 0.65);
            this.waveGraphics.beginPath();
            this.waveGraphics.moveTo(p0.x, p0.y);
            this.waveGraphics.lineTo(p1.x, p1.y);
            this.waveGraphics.strokePath();
          }

          // Sea surface shimmer line
          this.waveGraphics.lineStyle(1.5, 0x00d4ff, 0.35);
          this.waveGraphics.beginPath();
          for (let wx = 0; wx <= width; wx += 3) {
            const wy = waterY + Math.sin(wx * 0.05 + time * 1.2) * 2;
            if (wx === 0) this.waveGraphics.moveTo(wx, wy);
            else this.waveGraphics.lineTo(wx, wy);
          }
          this.waveGraphics.strokePath();

          // Glowing dot at latest price
          const last = pts[pts.length - 1];
          const lastIsUp = prices[prices.length - 1] >= prices[prices.length - 2];
          const dotColor = lastIsUp ? 0x00ff88 : 0xff4444;
          const aboveSurface = last.y < waterY;
          this.waveGraphics.fillStyle(dotColor, aboveSurface ? 0.4 : 0.2);
          this.waveGraphics.fillCircle(last.x, last.y, 7);
          this.waveGraphics.fillStyle(dotColor, aboveSurface ? 1 : 0.6);
          this.waveGraphics.fillCircle(last.x, last.y, 3);
        }

        private drawPriceScale(width: number, height: number, priceHistory: number[], currentPrice: number) {
          this.priceScaleGraphics.clear();

          const waterY = height * 0.68;
          const chartDepth = 55;
          const chartRise  = 10;
          const totalRange = chartDepth + chartRise;

          const prices = priceHistory.length >= 2 ? priceHistory : [currentPrice];
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const priceRange = maxP - minP || 100;

          const priceToY = (p: number) =>
            (waterY + chartDepth) - ((p - minP) / priceRange) * totalRange;

          const axisX = width - 8; // right edge
          const topY  = priceToY(maxP);
          const botY  = priceToY(minP);

          // Vertical axis line
          this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.8);
          this.priceScaleGraphics.beginPath();
          this.priceScaleGraphics.moveTo(axisX, topY);
          this.priceScaleGraphics.lineTo(axisX, botY);
          this.priceScaleGraphics.strokePath();

          // 5 evenly-spaced tick marks + labels
          for (let i = 0; i < 5; i++) {
            const t = i / 4;
            const tickPrice = minP + t * priceRange;
            const tickY = priceToY(tickPrice);

            // Tick mark
            this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.7);
            this.priceScaleGraphics.beginPath();
            this.priceScaleGraphics.moveTo(axisX - 4, tickY);
            this.priceScaleGraphics.lineTo(axisX, tickY);
            this.priceScaleGraphics.strokePath();

            // Subtle horizontal grid line
            this.priceScaleGraphics.lineStyle(1, 0x1a3a5c, 0.15);
            this.priceScaleGraphics.beginPath();
            this.priceScaleGraphics.moveTo(0, tickY);
            this.priceScaleGraphics.lineTo(axisX - 4, tickY);
            this.priceScaleGraphics.strokePath();

            // Label
            const label = this.priceScaleLabels[i];
            if (label) {
              label.setText(`$${Math.round(tickPrice).toLocaleString()}`);
              label.setPosition(axisX - 6, tickY);
            }
          }

          // Current price marker
          const curY = priceToY(currentPrice);
          const isUp = currentPrice >= prices[0];
          const markerColor = isUp ? 0x00ff88 : 0xff4444;

          // Dashed horizontal line at current price
          this.priceScaleGraphics.lineStyle(1, markerColor, 0.5);
          for (let dx = 0; dx < axisX - 4; dx += 8) {
            this.priceScaleGraphics.beginPath();
            this.priceScaleGraphics.moveTo(dx, curY);
            this.priceScaleGraphics.lineTo(Math.min(dx + 4, axisX - 4), curY);
            this.priceScaleGraphics.strokePath();
          }

          // Triangle marker on axis
          this.priceScaleGraphics.fillStyle(markerColor, 1);
          this.priceScaleGraphics.beginPath();
          this.priceScaleGraphics.moveTo(axisX + 2, curY);
          this.priceScaleGraphics.lineTo(axisX - 6, curY - 5);
          this.priceScaleGraphics.lineTo(axisX - 6, curY + 5);
          this.priceScaleGraphics.closePath();
          this.priceScaleGraphics.fillPath();

          // Current price label
          if (this.currentPriceLabel) {
            this.currentPriceLabel.setText(`$${Math.round(currentPrice).toLocaleString()}`);
            this.currentPriceLabel.setPosition(axisX - 9, curY);
            this.currentPriceLabel.setColor(isUp ? '#00ff88' : '#ff4444');
          }
        }

        private drawPriceZones(width: number, height: number) {
          this.overlayGraphics.clear();

          if (!this.positionSide || this.entryPrice <= 0) return;

          const waterY = height * 0.68;
          const waveHeight = 40;

          const minP = Math.min(...this.priceHistory);
          const maxP = Math.max(...this.priceHistory);
          const visibleRange = Math.max(maxP - minP, 200);

          const priceToY = (price: number) => {
            return waterY - ((price - minP) / visibleRange) * waveHeight;
          };

          const entryY = priceToY(this.entryPrice);
          const currentY = priceToY(this.currentPrice);
          const liqY = this.liquidationPrice > 0 ? priceToY(this.liquidationPrice) : 0;

          if (this.positionSide === 'long') {
            if (liqY > 0) {
              this.overlayGraphics.fillStyle(0x00ff88, 0.06);
              this.overlayGraphics.fillRect(0, entryY, width, Math.abs(liqY - entryY));
            }
          } else {
            if (liqY > 0) {
              this.overlayGraphics.fillStyle(0xff3333, 0.06);
              this.overlayGraphics.fillRect(0, liqY, width, Math.abs(entryY - liqY));
            }
          }

          const dashLen = 8;
          this.overlayGraphics.lineStyle(1, 0xffffff, 0.5);
          for (let dx = 0; dx < width; dx += dashLen * 2) {
            this.overlayGraphics.beginPath();
            this.overlayGraphics.moveTo(dx, entryY);
            this.overlayGraphics.lineTo(Math.min(dx + dashLen, width), entryY);
            this.overlayGraphics.strokePath();
          }

          this.overlayGraphics.lineStyle(1, 0x00d4ff, 0.5);
          for (let dx = 0; dx < width; dx += dashLen * 2) {
            this.overlayGraphics.beginPath();
            this.overlayGraphics.moveTo(dx, currentY);
            this.overlayGraphics.lineTo(Math.min(dx + dashLen, width), currentY);
            this.overlayGraphics.strokePath();
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

          this.tweens.add({
            targets: cannonBall,
            x: fortressX,
            y: this.shipY - 30,
            ease: 'Sine.easeOut',
            duration: 800,
            onUpdate: () => {
              trailPositions.unshift({ x: cannonBall.x, y: cannonBall.y });
              if (trailPositions.length > maxTrail) trailPositions.pop();

              trailGraphics.clear();
              trailPositions.forEach((tp, idx) => {
                const trailAlpha = (0.8 * (1 - idx / maxTrail));
                const trailRadius = 4 * (1 - idx / maxTrail);
                const trailColor = idx < maxTrail / 2 ? 0xffaa00 : 0xff4400;
                trailGraphics.fillStyle(trailColor, trailAlpha);
                trailGraphics.fillCircle(tp.x, tp.y, trailRadius);
              });
            },
            onComplete: () => {
              cannonBall.destroy();
              trailGraphics.destroy();
              createSplash();
              // Impact flash
              const impactFlash = this.add.graphics();
              impactFlash.fillStyle(0xff8800, 0.9);
              impactFlash.fillCircle(0, 0, 20);
              impactFlash.x = fortressX;
              impactFlash.y = this.shipY - 30;
              impactFlash.setDepth(22);
              this.tweens.add({
                targets: impactFlash,
                alpha: 0,
                scaleX: 3,
                scaleY: 3,
                duration: 300,
                onComplete: () => impactFlash.destroy(),
              });

              // Screen flash (brief white overlay)
              const screenFlash = this.add.graphics();
              screenFlash.fillStyle(0xffffff, 0.25);
              screenFlash.fillRect(0, 0, this.scale.width, this.scale.height);
              screenFlash.setDepth(48);
              this.tweens.add({
                targets: screenFlash,
                alpha: 0,
                duration: 200,
                onComplete: () => screenFlash.destroy(),
              });
            },
          });

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

        update(time: number, delta: number) {
          const { width, height } = this.scale;
          this.waveTime += delta * 0.001;
          this.shipRockTime += delta * 0.001;
          this.frameCount++;

          const currentStore = storeRef.current;

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

          // Draw price zones overlay (before waves)
          this.drawPriceZones(width, height);

          // Draw waves
          this.drawWaves(width, height, this.waveTime, this.priceHistory);

          // Draw price scale (right axis)
          this.drawPriceScale(width, height, this.priceHistory, this.currentPrice);

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
      marginHealth: store.position?.marginHealth ?? 100,
      gamePhase: store.gamePhase,
      unrealizedPnl: store.position?.unrealizedPnl ?? 0,
      combo: store.combo,
      entryPrice: store.position?.entryPrice ?? 0,
      positionSide: store.position?.side ?? null,
      liquidationPrice: store.position?.liquidationPrice ?? 0,
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
  }, [store.currentPrice, store.gamePhase, store.position, store.priceHistory, store.combo]);

  return (
    <div
      ref={containerRef}
      id="game-container"
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
