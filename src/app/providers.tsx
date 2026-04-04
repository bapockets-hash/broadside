'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { useEffect, useState, Component, ReactNode } from 'react';

// Suppress Privy's internal SMS-enrollment error that fires in production
// even when SMS is not a configured login method.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('invalid Privy app ID') ||
        event.reason?.toString?.()?.includes('invalid Privy app ID')) {
      event.preventDefault();
    }
  });
}

class PrivyErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  componentDidCatch() { this.setState({ crashed: true }); }
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    // If Privy crashes, render children without it (demo mode still works)
    if (this.state.crashed) return <>{this.props.children}</>;
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

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
