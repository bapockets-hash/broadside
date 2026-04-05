'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPacificaClient } from '@/lib/pacifica';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';

const BUILDER_CODE = (process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || '').trim();
const MAX_FEE_RATE = '0.001'; // 0.1%

function localKey(wallet: string) {
  return `broadside_builder_approved_${wallet}`;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getCachedApproval(wallet: string): boolean {
  try {
    const raw = localStorage.getItem(localKey(wallet));
    if (!raw) return false;
    const { approved, ts } = JSON.parse(raw);
    return approved === true && Date.now() - ts < CACHE_TTL_MS;
  } catch { return false; }
}

function setCachedApproval(wallet: string) {
  try {
    localStorage.setItem(localKey(wallet), JSON.stringify({ approved: true, ts: Date.now() }));
  } catch { /* ignore */ }
}

export default function BuilderApprovalModal() {
  const { walletAddress, signFn } = usePacificaSigner();

  const [show, setShow] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Check approval status once wallet is known
  useEffect(() => {
    if (!walletAddress || !BUILDER_CODE) return;

    if (getCachedApproval(walletAddress)) return;

    const client = createPacificaClient(walletAddress, async () => 'demo-sig');
    client.checkBuilderApproval(BUILDER_CODE).then(approved => {
      if (approved) {
        setCachedApproval(walletAddress);
      } else {
        setShow(true);
      }
    }).catch(() => {
      // API unreachable — show modal so user can try
      setShow(true);
    });
  }, [walletAddress]);

  const handleApprove = useCallback(async () => {
    if (!walletAddress) return;
    setError('');
    setSigning(true);

    try {
      const client = createPacificaClient(walletAddress, signFn);
      await client.approveBuilderCode(BUILDER_CODE, MAX_FEE_RATE);
      localStorage.setItem(localKey(walletAddress), 'true');
      setDone(true);
      setTimeout(() => setShow(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed — try again');
    } finally {
      setSigning(false);
    }
  }, [walletAddress, signFn]);

  const handleLater = useCallback(() => setShow(false), []);

  if (!show || !walletAddress || !BUILDER_CODE) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 70, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }}
    >
      <div
        style={{
          background: 'rgba(5,15,30,0.98)',
          border: '2px solid rgba(0,212,255,0.5)',
          borderRadius: '12px',
          padding: '28px 32px',
          width: '340px',
          boxShadow: '0 0 60px rgba(0,212,255,0.15)',
          fontFamily: 'var(--font-share-tech-mono, monospace)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.35em', color: '#00d4ff', marginBottom: '8px' }}>
            CAPTAIN — ONE-TIME AUTHORIZATION
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '0.1em' }}>
            ⚓ AUTHORIZE BROADSIDE
          </div>
        </div>

        {/* Explanation */}
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '16px' }}>
          Broadside needs your signature to submit orders on your behalf via the Pacifica builder program.
        </div>

        {/* Details */}
        <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '6px', padding: '12px', marginBottom: '20px' }}>
          {[
            { label: 'BUILDER CODE', value: BUILDER_CODE.toUpperCase() },
            { label: 'MAX FEE RATE', value: `${(parseFloat(MAX_FEE_RATE) * 100).toFixed(1)}%` },
            { label: 'REVOCABLE', value: 'YES — ANYTIME' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', color: '#556', letterSpacing: '0.1em' }}>{label}</span>
              <span style={{ fontSize: '11px', color: '#00d4ff' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: '11px', color: '#ff4444', marginBottom: '12px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Done state */}
        {done && (
          <div style={{ fontSize: '13px', color: '#00ff88', textAlign: 'center', marginBottom: '12px', letterSpacing: '0.15em' }}>
            ✓ AUTHORIZED
          </div>
        )}

        {/* Buttons */}
        {!done && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleApprove}
              disabled={signing}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '6px',
                border: '1px solid rgba(0,212,255,0.6)',
                background: signing ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.12)',
                color: signing ? 'rgba(0,212,255,0.4)' : '#00d4ff',
                cursor: signing ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontFamily: 'monospace',
                letterSpacing: '0.12em',
              }}
            >
              {signing ? 'SIGNING...' : 'SIGN & AUTHORIZE'}
            </button>
            <button
              onClick={handleLater}
              disabled={signing}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              LATER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
