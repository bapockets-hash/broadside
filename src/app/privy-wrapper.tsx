'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { ReactNode, Component, useEffect } from 'react';

// Suppress Privy's async initEnrollmentWithSms error which fires in production
// even when SMS is not a configured login method (Privy v3 bug).
function usePrivyErrorSuppressor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (event.message?.includes('invalid Privy app ID')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? '');
      if (msg.includes('invalid Privy app ID')) {
        event.preventDefault();
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);
}

class PrivyErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: Error) {
    console.warn('[Privy] Caught initialization error:', error.message);
  }
  render() {
    if (this.state.crashed) return <>{this.props.children}</>;
    return this.props.children;
  }
}

function PrivyMount({ children }: { children: ReactNode }) {
  usePrivyErrorSuppressor();
  const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          walletChainType: 'solana-only',
          walletList: ['detected_solana_wallets', 'phantom', 'backpack'],
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export default function PrivyWrapper({ children }: { children: ReactNode }) {
  return (
    <PrivyErrorBoundary>
      <PrivyMount>{children}</PrivyMount>
    </PrivyErrorBoundary>
  );
}
