'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useEffect, useRef, useState } from 'react';

export default function ConnectWallet() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const hasWallet = wallets.length > 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [radarAngle, setRadarAngle] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't block forever if Privy fails to initialize (e.g. bad app ID)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function handleDeploy() {
    login();
  }

  // Animate radar sweep
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle(prev => (prev + 2) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Draw radar on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.45;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,20,40,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(scale => {
      ctx.strokeStyle = `rgba(0,212,255,${0.1 + scale * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Cross lines
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 1;
    [0, 1, 2, 3].forEach(i => {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.stroke();
    });

    // Diagonal lines
    [0.25, 0.75].forEach(t => {
      const angle = t * Math.PI * 2;
      ctx.strokeStyle = 'rgba(0,212,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.stroke();
    });

    // Radar sweep gradient
    const sweepAngle = (radarAngle * Math.PI) / 180;

    // Manual sweep wedge
    ctx.save();
    ctx.globalAlpha = 0.4;
    const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    sweepGrad.addColorStop(0, 'rgba(0,212,255,0.3)');
    sweepGrad.addColorStop(1, 'rgba(0,212,255,0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sweepAngle - Math.PI / 4, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = sweepGrad;
    ctx.fill();
    ctx.restore();

    // Sweep line
    ctx.strokeStyle = 'rgba(0,212,255,0.8)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Blips
    const blips = [
      { angle: 45, dist: 0.6 },
      { angle: 130, dist: 0.8 },
      { angle: 220, dist: 0.45 },
      { angle: 310, dist: 0.7 },
    ];
    blips.forEach(blip => {
      const blipAngle = (blip.angle * Math.PI) / 180;
      const bx = cx + Math.cos(blipAngle) * r * blip.dist;
      const by = cy + Math.sin(blipAngle) * r * blip.dist;
      const distToSweep = Math.abs(((blip.angle - radarAngle + 360) % 360));
      const alpha = distToSweep < 90 ? 1 - distToSweep / 90 : 0;

      if (alpha > 0) {
        ctx.fillStyle = `rgba(0,255,136,${alpha * 0.9})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00ff88';
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Center dot
    ctx.fillStyle = '#00d4ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Compass labels
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - r + 12);
    ctx.fillText('S', cx, cy + r - 12);
    ctx.fillText('E', cx + r - 10, cy);
    ctx.fillText('W', cx - r + 10, cy);

  }, [radarAngle]);

  // Skip loading screen after timeout — show game in demo mode
  if (!ready && !timedOut) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ background: '#0a1628' }}
      >
        <div className="font-mono text-sm" style={{ color: '#00d4ff' }}>
          INITIALIZING SYSTEMS...
        </div>
      </div>
    );
  }

  // Hide once authenticated AND a Solana wallet is available (or user chose demo)
  if ((authenticated && hasWallet) || dismissed) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{
        background: 'radial-gradient(ellipse at center, #0d1f3a 0%, #050e1a 100%)',
      }}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 text-center px-8 max-w-lg">
        {/* Title */}
        <div
          className="font-mono font-black tracking-widest mb-2"
          style={{
            fontSize: 'clamp(24px, 5vw, 40px)',
            color: '#00d4ff',
            textShadow: '0 0 40px rgba(0,212,255,0.8), 0 0 80px rgba(0,212,255,0.4)',
            letterSpacing: '0.2em',
          }}
        >
          BATTLESHIP PERPS
        </div>

        {/* Subtitle */}
        <div
          className="font-mono text-sm tracking-widest mb-6"
          style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.6)' }}
        >
          ⚓ PACIFICA PERPETUALS ⚓
        </div>

        {/* Radar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={200}
              height={200}
              className="rounded-full"
              style={{ border: '2px solid rgba(0,212,255,0.3)' }}
            />
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: 'inset 0 0 30px rgba(0,212,255,0.1)' }}
            />
          </div>
        </div>

        {/* Description */}
        <div
          className="font-mono text-sm mb-6 leading-relaxed"
          style={{ color: '#4a7a9b' }}
        >
          Command your fleet in the battle against market volatility.
          <br />
          Open perpetual positions. Sink the competition.
        </div>

        {/* Feature pills */}
        <div className="flex gap-2 justify-center mb-6 flex-wrap">
          {['⚔ SHORT = ATTACK', '🛡 LONG = DEFEND', '💥 LIQUIDATION = SUNK'].map(feat => (
            <div
              key={feat}
              className="px-3 py-1 rounded-full text-xs font-mono"
              style={{
                background: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#00d4ff',
              }}
            >
              {feat}
            </div>
          ))}
        </div>

        {/* Connect button — or reconnect if authenticated without a Solana wallet */}
        {authenticated && !hasWallet ? (
          <>
            <div className="mb-3 text-xs font-mono text-center" style={{ color: '#ffd700' }}>
              Session found — reconnect your Solana wallet to trade live
            </div>
            <button
              onClick={async () => { await logout(); login(); }}
              className="w-full py-4 rounded font-mono font-bold text-lg tracking-widest transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(200,150,0,0.2))',
                border: '2px solid #ffd700',
                color: '#ffd700',
                textShadow: '0 0 20px rgba(255,215,0,0.8)',
                boxShadow: '0 0 30px rgba(255,215,0,0.2)',
                cursor: 'pointer',
              }}
            >
              ⚓ RECONNECT WALLET
            </button>
          </>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={!ready}
            className="w-full py-4 rounded font-mono font-bold text-lg tracking-widest transition-all"
            style={{
              background: ready
                ? 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,100,180,0.3))'
                : 'rgba(0,212,255,0.05)',
              border: '2px solid #00d4ff',
              color: ready ? '#00d4ff' : 'rgba(0,212,255,0.35)',
              textShadow: ready ? '0 0 20px rgba(0,212,255,0.8)' : 'none',
              boxShadow: ready ? '0 0 30px rgba(0,212,255,0.3), inset 0 0 30px rgba(0,212,255,0.05)' : 'none',
              cursor: ready ? 'pointer' : 'wait',
            }}
            onMouseEnter={e => {
              if (ready) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 50px rgba(0,212,255,0.6), inset 0 0 30px rgba(0,212,255,0.1)';
            }}
            onMouseLeave={e => {
              if (ready) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(0,212,255,0.3), inset 0 0 30px rgba(0,212,255,0.05)';
            }}
          >
            {ready ? '⚓ DEPLOY FLEET' : 'INITIALIZING...'}
          </button>
        )}

        <div className="mt-3 text-xs font-mono" style={{ color: '#444' }}>
          Connect Phantom or any Solana wallet to begin
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="mt-2 text-xs font-mono underline"
          style={{ color: '#2a4a6a', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Play as guest (demo mode)
        </button>
      </div>
    </div>
  );
}
