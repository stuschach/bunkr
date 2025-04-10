// src/components/common/ThemeProvider.tsx
'use client';

import { useThemeEffect } from '@/lib/hooks/useThemeEffect';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useThemeEffect();
  return <>{children}</>;
}