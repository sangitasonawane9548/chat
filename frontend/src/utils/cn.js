import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional CSS class names safely with Tailwind conflict resolution
 * @param {...any} inputs 
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

