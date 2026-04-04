'use client';

import { useEffect, useRef, useState } from 'react';
import { usePacificaSigner } from '@/hooks/usePacificaSigner';
import { createPacificaClient } from '@/lib/pacifica';

const POLL_INTERVAL = 15_000; // 15 seconds

export function useAccountBalance() {
  const { walletAddress, signFn } = usePacificaSigner();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    let active = true;
    const client = createPacificaClient(walletAddress, signFn);

    async function fetch() {
      if (!active) return;
      setLoading(true);
      const val = await client.getBalance();
      if (active) {
        setBalance(val);
        setLoading(false);
      }
    }

    fetch();
    timerRef.current = setInterval(fetch, POLL_INTERVAL);

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [walletAddress, signFn]);

  return { balance, loading };
}
