import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AuthProvider } from '@/features/auth/ui/AuthProvider';
import { env } from '@/shared/config/env';
import { queryClient } from '@/shared/lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/** Providers globales: React Query + Auth (+ Devtools en desarrollo). */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {env.isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </AuthProvider>
    </QueryClientProvider>
  );
}
