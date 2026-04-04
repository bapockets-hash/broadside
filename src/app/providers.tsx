'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const PrivyWrapper = dynamic(() => import('./privy-wrapper'), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  return <PrivyWrapper>{children}</PrivyWrapper>;
}
