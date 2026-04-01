'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function BannerConditional({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return <>{children}</>;
}
