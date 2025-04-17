'use client';

import React, { useState, useEffect } from 'react';
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
import { ScorecardProvider } from '@/lib/contexts/ScoreCardContext';
import { TeeTimeProvider } from '@/lib/contexts/TeeTimeContext'; 
import { OfflineManager } from '@/lib/services/OfflineManager';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import { cacheService } from '@/lib/services/CacheService'; // Import the singleton instance directly

/**
 * Scorecard sync provider that handles offline synchronization
 * Extracted from ScorecardAppProvider to integrate with existing providers
 */
const ScorecardSyncProvider = ({ children }) => {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  const [hasOfflineData, setHasOfflineData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  // Check for pending offline operations and online status
  useEffect(() => {
    if (!user) return;
    
    // Set up offline/online event listeners
    const handleOnline = async () => {
      setIsOnline(true);
      showNotification({
        type: 'success',
        title: 'Back Online',
        description: 'Your connection has been restored.'
      });
      
      // Check for pending operations
      const operations = OfflineManager.getOfflineOperations()
        .filter(op => op.userId === user.uid);
      
      if (operations.length > 0) {
        setHasOfflineData(true);
      } else {
        await OfflineManager.processOfflineOperations(user.uid);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      showNotification({
        type: 'warning',
        title: 'You are offline',
        description: 'Changes will be saved locally and synced when you reconnect.'
      });
    };
    
    // Set initial online state
    setIsOnline(OfflineManager.isOnline());
    
    // Check for pending operations
    const operations = OfflineManager.getOfflineOperations()
      .filter(op => op.userId === user.uid);
    
    if (operations.length > 0) {
      setHasOfflineData(true);
    }
    
    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up sync listeners
    OfflineManager.setupSyncListeners(user.uid);
    
    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, showNotification]);
  
  // Sync offline data
  const handleSync = async () => {
    if (!user || !isOnline) return;
    
    setIsSyncing(true);
    
    try {
      const results = await OfflineManager.processOfflineOperations(user.uid);
      
      if (results.length > 0) {
        showNotification({
          type: 'success',
          title: 'Sync Complete',
          description: `Successfully synced ${results.length} offline changes.`
        });
        setHasOfflineData(false);
      } else {
        showNotification({
          type: 'info',
          title: 'No Changes to Sync',
          description: 'All your data is already up to date.'
        });
      }
    } catch (error) {
      console.error('Error syncing offline data:', error);
      showNotification({
        type: 'error',
        title: 'Sync Failed',
        description: 'There was a problem syncing your offline data.'
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Show sync banner if offline data exists
  const renderSyncBanner = () => {
    if (hasOfflineData && isOnline) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 border-b border-yellow-200 dark:border-yellow-800 flex items-center justify-between">
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsynchronized scorecard data. Sync now to update your records.
          </div>
          <button 
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      );
    }
    
    return null;
  };
  
  // Show offline indicator
  const renderOfflineIndicator = () => {
    if (!isOnline) {
      return (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded-full text-sm shadow-lg z-50">
          Offline Mode
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <>
      {renderSyncBanner()}
      {children}
      {renderOfflineIndicator()}
    </>
  );
};

interface ApiProvidersProps {
  children: React.ReactNode;
}

/**
 * Initialize all client-side services that need to run at startup
 */
function useServiceInitialization() {
  // This hook ensures services are initialized only once and only on the client side
  useEffect(() => {
    console.log('Initializing client-side services...');
    
    // Use the singleton instance directly
    console.log('Core cache service initialized:', cacheService);
    
    // Tee time cache capabilities are now integrated into the main CacheService
    console.log('Tee time cache initialized');
    
    // Additional service initializations can be added here
  }, []);
}

export const ApiProviders: React.FC<ApiProvidersProps> = ({ children }) => {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(() => createQueryClient());
  
  // Initialize services
  useServiceInitialization();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <TeeTimeProvider>
              <FollowProvider>
                <ResponsiveProvider>
                  <UserPreferencesProvider>
                    <VisibilityProvider>
                      <ScorecardProvider>
                        <ScorecardSyncProvider>
                          {children}
                        </ScorecardSyncProvider>
                      </ScorecardProvider>
                    </VisibilityProvider>
                  </UserPreferencesProvider>
                </ResponsiveProvider>
              </FollowProvider>
            </TeeTimeProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};