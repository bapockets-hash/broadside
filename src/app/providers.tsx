'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          walletList: ['phantom', 'backpack'],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
