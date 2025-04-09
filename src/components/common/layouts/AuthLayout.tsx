import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface AuthLayoutProps {
  children: React.ReactNode;
  showLogo?: boolean;
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({
  children,
  showLogo = true,
  backgroundImage = '/assets/images/auth/golf-course-bg.jpg',
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Form */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 p-6 sm:p-10 bg-white dark:bg-gray-950">
        {showLogo && (
          <div className="mb-8">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-green-500">Bunkr</span>
            </Link>
          </div>
        )}

        {(title || subtitle) && (
          <div className="text-center mb-8">
            {title && <h1 className="text-2xl font-bold mb-2">{title}</h1>}
            {subtitle && <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>}
          </div>
        )}

        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Right Panel - Background Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        {/* This would render a real image in production */}
        <div className="absolute inset-0 bg-green-500/20">
          {/* Placeholder for background image that would be loaded in production */}
          <div
            className={cn(
              "w-full h-full bg-cover bg-center",
              "bg-gradient-to-br from-green-500/40 to-sand-300/40"
            )}
          ></div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-12">
          <div className="max-w-md text-center">
            <h2 className="text-3xl font-bold mb-4">Welcome to the Bunkr Community</h2>
            <p className="text-lg">
              Connect with fellow golfers, track your scores, and improve your game.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}