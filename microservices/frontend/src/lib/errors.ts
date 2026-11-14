import { ApiError } from '@/api/types';

/** Translation key for an error. Technical messages are never shown to the user. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_input') return 'errors.invalid';
    if (error.code === 'network') return 'errors.network';
    if (error.code === 'rate_limited') return 'errors.rateLimited';
    if (error.code === 'busy') return 'errors.busy';
  }
  return 'errors.generic';
}
