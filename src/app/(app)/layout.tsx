// src/app/(app)/layout.tsx
import { AppLayout } from '@/components/common/layouts/AppLayout';

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}