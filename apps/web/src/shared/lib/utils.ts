import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge de clases para componentes Shadcn (`tw-*`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
