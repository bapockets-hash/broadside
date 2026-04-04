'use client';

import { useCallback } from 'react';
import bs58 from 'bs58';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';

type ExtensionProvider = {
  publicKey: { toString(): string } | null;
  connect: () => Promise<unknown>;
  signMessage: (msg: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

function getExtensionProvider(): ExtensionProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const phantom = (w.phantom as Record<string, unknown>)?.solana as ExtensionProvider | undefined;
  if (phantom?.publicKey) return phantom;
  const backpack = w.backpack as ExtensionProvider | undefined;
  if (backpack?.publicKey) return backpack;
  const solana = w.solana as ExtensionProvider | undefined;
  if (solana?.publicKey) return solana;
  return null;
}

/**
 * Returns the connected Solana wallet address and a sign function.
 * Address comes from Privy's useWallets() (stable, no polling).
 * Signing tries the direct browser extension first (avoids Privy proxy
 * keyring errors), then falls back to Privy's useSignMessage for
 * embedded wallets.
 */
export function usePacificaSigner() {
  const { wallets } = useWallets();
  const { signMessage: privySignMessage } = useSignMessage();

  const privyWallet = wallets[0] ?? null;
  const walletAddress = privyWallet?.address ?? null;

  const signFn = useCallback(async (message: string): Promise<string> => {
    if (!walletAddress) {
      throw new Error('No wallet connected — please connect your wallet first');
    }

    const encoded = new TextEncoder().encode(message);

    // Try direct extension first — avoids Privy proxy keyring errors.
    // Always call connect() first: extension service workers restart periodically
    // and lose their in-memory keyring; connect() reloads it.
    const ext = getExtensionProvider();
    if (ext?.publicKey?.toString() === walletAddress) {
      await ext.connect();
      const { signature } = await ext.signMessage(encoded, 'utf8');
      return bs58.encode(signature);
    }

    // Fall back to Privy for embedded wallets
    if (!privyWallet) throw new Error('No wallet connected');
    const { signature } = await privySignMessage({ message: encoded, wallet: privyWallet });
    return bs58.encode(signature);
  }, [walletAddress, privyWallet, privySignMessage]);

  return { walletAddress, signFn };
}
