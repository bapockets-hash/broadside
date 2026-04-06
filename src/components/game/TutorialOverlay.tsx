'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Step {
  title: string;
  content: string;
  targetId?: string;
  tooltipSide?: 'above' | 'below' | 'right';
  padding?: number;
}

const STEPS: Step[] = [
  {
    title: 'WELCOME, ADMIRAL',
    content: 'Broadside is a real-money trading game built on Pacifica perpetuals. Trade real assets with real stakes — wrapped in naval combat. This guide walks you through the controls.',
  },
  {
    title: 'THE BATTLE ARENA',
    content: 'The fortress represents the current market price. Watch it move in real time as the market breathes. Your mission: predict which way it goes.',
    targetId: 'game-canvas',
    tooltipSide: 'below',
  },
  {
    title: 'SELECT YOUR TARGET',
    content: 'Choose which asset to trade — BTC, ETH, SOL, stocks, forex and more. A green dot next to a ticker means you already have an open position on it.',
    targetId: 'asset-selector',
    tooltipSide: 'above',
  },
  {
    title: 'CHOOSE YOUR STANCE',
    content: '⚔ ATTACK = Short. You profit when price falls.\n🛡 DEFEND = Long. You profit when price rises.\n\nPick your side before firing.',
    targetId: 'side-buttons',
    tooltipSide: 'above',
  },
  {
    title: 'SET POWER LEVEL',
    content: 'Leverage multiplies your exposure. At 10x, a 1% price move = 10% gain or loss on your margin. Higher power means higher risk. Start at 1–3x until you find your footing.',
    targetId: 'leverage-slider',
    tooltipSide: 'above',
  },
  {
    title: 'FLEET ORDERS',
    content: 'Set your margin — the amount you\'re risking. Use the quick buttons for common sizes. Once target, stance, and size are set, hit FIRE to open the position. RETREAT closes it.',
    targetId: 'fleet-orders',
    tooltipSide: 'above',
  },
  {
    title: 'HULL INTEGRITY',
    content: 'This bar shows how close you are to liquidation. If it hits 0% your ship is sunk — the position closes automatically and your margin is lost. Watch it closely.',
    targetId: 'hull-integrity',
    tooltipSide: 'below',
  },
  {
    title: 'YOUR FLEET',
    content: 'All open positions appear here. Click any row to switch the chart to that asset. The ✕ button closes a position immediately.',
    targetId: 'positions-list',
    tooltipSide: 'right',
  },
  {
    title: 'READY TO SAIL',
    content: 'That\'s the full briefing, Admiral. May the market move in your favour.\n\nHit the ? button at any time to replay this guide.',
  },
];

const CARD_WIDTH = 340;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function TutorialOverlay() {
  const tutorialSeen = useGameStore(s => s.tutorialSeen);
  const tutorialOpen = useGameStore(s => s.tutorialOpen);
  const setTutorialSeen = useGameStore(s => s.setTutorialSeen);
  const setTutorialOpen = useGameStore(s => s.setTutorialOpen);

  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const isOpen = tutorialOpen || !tutorialSeen;

  const handleClose = useCallback(() => {
    setTutorialOpen(false);
    setTutorialSeen(true);
  }, [setTutorialOpen, setTutorialSeen]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleClose();
    }
  }, [step, handleClose]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // ESC to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose, handleNext, handlePrev]);

  // Find target element and compute spotlight rect
  useEffect(() => {
    if (!isOpen) return;
    const current = STEPS[step];
    if (!current.targetId) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial-id="${current.targetId}"]`);
    if (!el) {
      setSpotlight(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [isOpen, step]);

  // Reset step when re-opened
  useEffect(() => {
    if (tutorialOpen) setStep(0);
  }, [tutorialOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const pad = current.padding ?? 10;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  // Compute tooltip card position
  let cardTop: number | string = '50%';
  let cardLeft: number | string = '50%';
  let cardTransform = 'translate(-50%, -50%)';

  if (spotlight && typeof window !== 'undefined') {
    const { top, left, width, height } = spotlight;
    const side = current.tooltipSide ?? 'above';
    const vw = window.innerWidth;

    if (side === 'above') {
      cardTop = top - pad - 16 - 200; // 200 = approx card height, adjusted below via minHeight
      cardLeft = Math.min(vw - CARD_WIDTH - 12, Math.max(12, left + width / 2 - CARD_WIDTH / 2));
      cardTransform = 'none';
    } else if (side === 'below') {
      cardTop = top + height + pad + 16;
      cardLeft = Math.min(vw - CARD_WIDTH - 12, Math.max(12, left + width / 2 - CARD_WIDTH / 2));
      cardTransform = 'none';
    } else if (side === 'right') {
      cardTop = Math.max(12, top + height / 2 - 90);
      cardLeft = Math.min(vw - CARD_WIDTH - 12, left + width + pad + 16);
      cardTransform = 'none';
    }
  }

  return (
    <>
      <style>{`
        @keyframes tutorial-spotlight-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.82), 0 0 0 2px rgba(0,212,255,0.7); }
          50%       { box-shadow: 0 0 0 9999px rgba(0,0,0,0.82), 0 0 0 3px rgba(0,212,255,1), 0 0 20px rgba(0,212,255,0.4); }
        }
        @keyframes tutorial-card-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Full-screen backdrop — blocks interaction behind the tutorial but does NOT dismiss on click
           (click-through bug: mousedown on NEXT, DOM re-renders with backdrop, mouseup fires handleClose) */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: spotlight ? 'transparent' : 'rgba(0,0,0,0.82)',
          pointerEvents: 'all',
        }}
      />

      {/* Spotlight cutout */}
      {spotlight && (
        <div
          style={{
            position: 'fixed',
            top: spotlight.top - pad,
            left: spotlight.left - pad,
            width: spotlight.width + pad * 2,
            height: spotlight.height + pad * 2,
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)',
            border: '2px solid rgba(0,212,255,0.75)',
            zIndex: 1000,
            pointerEvents: 'none',
            animation: 'tutorial-spotlight-pulse 2.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: cardTop,
          left: cardLeft,
          transform: cardTransform,
          width: CARD_WIDTH,
          zIndex: 1001,
          background: 'rgba(4, 12, 28, 0.97)',
          border: '1px solid rgba(0,212,255,0.5)',
          borderRadius: '10px',
          padding: '20px 22px 16px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.08)',
          fontFamily: 'var(--font-share-tech-mono, monospace)',
          animation: 'tutorial-card-in 0.2s ease-out forwards',
        }}
      >
        {/* Step counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(0,212,255,0.5)' }}>
            BRIEFING
          </div>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(0,212,255,0.45)' }}>
            {step + 1} / {STEPS.length}
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '14px' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: '3px',
                flex: 1,
                borderRadius: '2px',
                background: i <= step ? 'rgba(0,212,255,0.8)' : 'rgba(0,212,255,0.15)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Title */}
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#ffd700',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-orbitron, monospace)',
          marginBottom: '10px',
          textShadow: '0 0 12px rgba(255,215,0,0.3)',
        }}>
          {current.title}
        </div>

        {/* Content */}
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.78)',
          lineHeight: '1.65',
          marginBottom: '18px',
          whiteSpace: 'pre-line',
        }}>
          {current.content}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isFirst && (
            <button
              onClick={handlePrev}
              style={{
                padding: '7px 14px',
                borderRadius: '5px',
                border: '1px solid rgba(0,212,255,0.25)',
                background: 'rgba(0,212,255,0.05)',
                color: 'rgba(0,212,255,0.6)',
                fontSize: '10px',
                letterSpacing: '0.1em',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              ← PREV
            </button>
          )}

          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '5px',
              border: '1px solid rgba(0,212,255,0.6)',
              background: isLast ? 'rgba(255,215,0,0.12)' : 'rgba(0,212,255,0.12)',
              color: isLast ? '#ffd700' : '#00d4ff',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '0.12em',
              fontFamily: 'monospace',
              cursor: 'pointer',
              boxShadow: isLast ? '0 0 16px rgba(255,215,0,0.2)' : '0 0 16px rgba(0,212,255,0.15)',
            }}
          >
            {isLast ? '⚓ SET SAIL' : 'NEXT →'}
          </button>

          <button
            onClick={handleClose}
            style={{
              padding: '7px 10px',
              borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            SKIP
          </button>
        </div>
      </div>
    </>
  );
}
