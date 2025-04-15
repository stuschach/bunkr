'use client';

import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from './client';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { ResponsiveProvider } from '@/lib/contexts/ResponsiveContext';
import { UserPreferencesProvider } from '@/lib/contexts/UserPreferencesContext';
import { FollowProvider } from '@/lib/contexts/FollowContext';
import { VisibilityProvider } from '@/lib/contexts/VisibilityContext';

interface ApiProvidersProps {
  children: React.ReactNode;
}

export const ApiProviders: React.FC<ApiProvidersProps> = ({ children }) => {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <FollowProvider>
              <ResponsiveProvider>
                <UserPreferencesProvider>
                  <VisibilityProvider>
                    {children}
                  </VisibilityProvider>
                </UserPreferencesProvider>
              </ResponsiveProvider>
            </FollowProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};