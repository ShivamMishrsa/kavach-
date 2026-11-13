import { ApiError } from '@/api/types';

/** Translation key for an error. Technical messages are never shown to the user. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_input') return 'errors.invalid';
    if (error.code === 'network') return 'errors.network';
  }
  return 'errors.generic';
}
