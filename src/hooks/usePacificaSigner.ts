'use client';

import { useCallback } from 'react';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

/**
 * Returns { walletAddress, signFn } ready for createPacificaClient.
 * signFn encodes the message as UTF-8, signs it with the first Solana wallet,
 * and base58-encodes the resulting Ed25519 signature bytes.
 */
export function usePacificaSigner() {
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();

  const wallet = wallets[0] ?? null;
  const walletAddress = wallet?.address ?? null;

  const signFn = useCallback(
    async (message: string): Promise<string> => {
      if (!wallet || !signMessage) return 'demo-sig';
      try {
        const encoded = new TextEncoder().encode(message);
        const { signature } = await signMessage({
          message: encoded,
          wallet: wallet as Parameters<typeof signMessage>[0]['wallet'],
        });
        return bs58.encode(signature);
      } catch (err) {
        console.warn('[Pacifica] signMessage failed:', err);
        return 'demo-sig';
      }
    },
    [wallet, signMessage]
  );

  return { walletAddress, signFn };
}
