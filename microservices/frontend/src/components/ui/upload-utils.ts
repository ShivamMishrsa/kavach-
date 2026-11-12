export const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];

export type UploadError = 'tooBig' | 'badType';

/** Returns an error key when the file is not allowed, otherwise null. */
export function validateFile(file: File, accept: string[], maxMb: number): UploadError | null {
  if (!accept.includes(file.type)) return 'badType';
  if (file.size > maxMb * 1024 * 1024) return 'tooBig';
  return null;
}
