'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode, Component } from 'react';

class PrivyErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: Error) {
    console.warn('[Privy] Initialization error suppressed:', error.message);
  }
  render() {
    if (this.state.crashed) return <>{this.props.children}</>;
    return this.props.children;
  }
}

export default function PrivyWrapper({ children }: { children: ReactNode }) {
  return (
    <PrivyErrorBoundary>
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
    </PrivyErrorBoundary>
  );
}
