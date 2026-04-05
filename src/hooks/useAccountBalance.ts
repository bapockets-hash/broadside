'use client';

import { useEffect, useRef, useState } from 'react';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';
import { createPacificaClient } from '@/lib/pacifica';

const POLL_INTERVAL = 60_000; // 60 seconds — getBalance is a plain GET, no need to poll aggressively

export function useAccountBalance() {
  const { walletAddress } = usePacificaSigner();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    let active = true;
    // getBalance is an unauthenticated GET — no signing needed
    const client = createPacificaClient(walletAddress, async () => '');

    async function fetchBalance() {
      if (!active) return;
      setLoading(true);
      const val = await client.getBalance();
      if (active) {
        setBalance(val);
        setLoading(false);
      }
    }

    fetchBalance();
    timerRef.current = setInterval(fetchBalance, POLL_INTERVAL);

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [walletAddress]); // signFn intentionally excluded — getBalance needs no signature

  return { balance, loading };
}
