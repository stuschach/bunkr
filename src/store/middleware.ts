// src/store/middleware.ts
import { StateCreator } from 'zustand';

// Simplified logger middleware
export const logger = <T>(f: StateCreator<T>) => 
  (set: any, get: any, store: any) => {
    const loggedSet: typeof set = (...args: any[]) => {
      const previousState = get();
      set(...args);
      const nextState = get();
      
      if (process.env.NODE_ENV === 'development') {
        console.group(
          '%cstore %cupdated',
          'color: #0070f3; font-weight: bold',
          'color: #999'
        );
        console.log(
          '%cprevious state',
          'color: #999; font-weight: bold',
          previousState
        );
        console.log('%cnext state', 'color: #47d247; font-weight: bold', nextState);
        console.groupEnd();
      }
    };
    
    return f(loggedSet, get, store);
  };