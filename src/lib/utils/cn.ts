import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper function to merge Tailwind classes properly
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}