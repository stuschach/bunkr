// src/lib/api/client.ts
import { 
    QueryClient, 
    DefaultOptions,
    QueryCache,
    MutationCache
  } from '@tanstack/react-query';
  import { useStore } from '@/store';
  
  // Define default options for all queries
  const defaultQueryOptions: DefaultOptions = {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  };
  
  // Create query client with error handling
  export const createQueryClient = () => {
    // Get error setting functions for global state
    const setGlobalError = useStore.getState().setGlobalError;
    const clearGlobalError = useStore.getState().clearGlobalError;
  
    return new QueryClient({
      defaultOptions: defaultQueryOptions,
      queryCache: new QueryCache({
        onError: (error: any, query: any) => {
          // Only handle errors that aren't handled by the query itself
          if (query.meta?.skipGlobalErrorHandler) {
            return;
          }
  
          if (error instanceof Error) {
            setGlobalError({ 
              message: error.message,
              details: error
            });
          }
        },
      }),
      mutationCache: new MutationCache({
        onError: (error: any, _variables: any, _context: any, mutation: any) => {
          // Only handle errors that aren't handled by the mutation itself
          if (mutation.meta?.skipGlobalErrorHandler) {
            return;
          }
  
          if (error instanceof Error) {
            setGlobalError({ 
              message: error.message,
              details: error
            });
          }
        },
        onSuccess: () => {
          // Clear global error on successful mutations
          clearGlobalError();
        },
      }),
    });
  };