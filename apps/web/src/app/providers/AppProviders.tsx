import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@/features/auth/ui/AuthProvider';
import { queryClient } from '@/shared/lib/query-client';
import { UserPreferencesProvider } from '@/shared/preferences';
import { AlertScrollObserver } from '@/shared/ui/AlertScrollObserver';
import { ToastProvider } from '@/shared/ui/ToastProvider';

interface AppProvidersProps {
  children: ReactNode;
}

/** Providers globales: React Query + Auth + preferencias + toasts. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserPreferencesProvider>
          <ToastProvider>
            <AlertScrollObserver />
            {children}
          </ToastProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
