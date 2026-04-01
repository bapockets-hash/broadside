'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize connectors inside the render function so they run client-side
  // after wallet extensions (Phantom, Backpack) have injected into the page
  const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: 'dark',
          walletChainType: 'solana-only',
          walletList: ['detected_solana_wallets', 'phantom', 'backpack'],
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
