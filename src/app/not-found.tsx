// src/app/not-found.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button>Return to Home</Button>
      </Link>
    </div>
  );
}