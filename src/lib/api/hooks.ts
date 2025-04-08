// src/lib/api/hooks.ts
import { 
    useQuery, 
    useMutation,
    useInfiniteQuery,
    type QueryKey
  } from '@tanstack/react-query';
  import { useStore } from '@/store';
  
  // Wrapper for useQuery with loading state integration
  export function useLoadingQuery<TData>(
    queryKey: QueryKey,
    queryFn: () => Promise<TData>,
    options: any = {}
  ) {
    const setIsLoading = useStore((state) => state.setIsLoading);
    const { showGlobalLoading = false, ...queryOptions } = options;
  
    return useQuery({
      queryKey,
      queryFn,
      ...queryOptions,
      onSettled: (data: any, error: any) => {
        if (showGlobalLoading) {
          setIsLoading(false);
        }
        if (options.onSettled) {
          options.onSettled(data, error);
        }
      },
    });
  }
  
  // Wrapper for useInfiniteQuery with loading state integration
  export function useLoadingInfiniteQuery<TData>(
    queryKey: QueryKey,
    queryFn: (params: { pageParam: any }) => Promise<TData>,
    options: any = {}
  ) {
    const setIsLoading = useStore((state) => state.setIsLoading);
    const { showGlobalLoading = false, ...queryOptions } = options;
  
    return useInfiniteQuery({
      queryKey,
      queryFn,
      ...queryOptions,
      onSettled: (data: any, error: any) => {
        if (showGlobalLoading) {
          setIsLoading(false);
        }
        if (options.onSettled) {
          options.onSettled(data, error);
        }
      },
    });
  }
  
  // Wrapper for useMutation with loading state integration
  export function useLoadingMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options: any = {}
  ) {
    const setIsLoading = useStore((state) => state.setIsLoading);
    const { showGlobalLoading = false, ...mutationOptions } = options;
  
    return useMutation({
      mutationFn,
      ...mutationOptions,
      onMutate: async (variables: TVariables) => {
        if (showGlobalLoading) {
          setIsLoading(true);
        }
        if (mutationOptions.onMutate) {
          return await mutationOptions.onMutate(variables);
        }
        return undefined;
      },
      onSettled: (data: any, error: any, variables: TVariables, context: any) => {
        if (showGlobalLoading) {
          setIsLoading(false);
        }
        if (mutationOptions.onSettled) {
          mutationOptions.onSettled(data, error, variables, context);
        }
      },
    });
  }