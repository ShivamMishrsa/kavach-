import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCEPT, validateFile } from './upload-utils';

function fakeFile(type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], 'sample', { type });
}

describe('validateFile', () => {
  it('accepts a small jpeg', () => {
    expect(validateFile(fakeFile('image/jpeg', 1024), DEFAULT_ACCEPT, 10)).toBeNull();
  });

  it('rejects an unsupported type', () => {
    expect(validateFile(fakeFile('application/x-msdownload', 1024), DEFAULT_ACCEPT, 10)).toBe(
      'badType',
    );
  });

  it('rejects a file over the size limit', () => {
    expect(validateFile(fakeFile('image/png', 11 * 1024 * 1024), DEFAULT_ACCEPT, 10)).toBe(
      'tooBig',
    );
  });

  it('accepts a file exactly at the limit', () => {
    expect(
      validateFile(fakeFile('application/pdf', 10 * 1024 * 1024), DEFAULT_ACCEPT, 10),
    ).toBeNull();
  });
});
