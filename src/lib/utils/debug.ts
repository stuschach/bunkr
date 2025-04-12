// src/lib/utils/debug.ts

const DEBUG = true; // Toggle this for production

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[BUNKR DEBUG]', ...args);
  }
}