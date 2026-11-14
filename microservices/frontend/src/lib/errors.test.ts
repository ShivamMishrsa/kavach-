import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/types';
import { errorKey } from './errors';

describe('errorKey', () => {
  it('picks a translation for each kind of error', () => {
    expect(errorKey(new ApiError('invalid_input', 'x'))).toBe('errors.invalid');
    expect(errorKey(new ApiError('network', 'x'))).toBe('errors.network');
    expect(errorKey(new ApiError('rate_limited', 'x'))).toBe('errors.rateLimited');
  });

  it('never shows technical text for anything else', () => {
    expect(errorKey(new ApiError('not_found', 'x'))).toBe('errors.generic');
    expect(errorKey(new Error('Server error 500'))).toBe('errors.generic');
    expect(errorKey('boom')).toBe('errors.generic');
  });
});
