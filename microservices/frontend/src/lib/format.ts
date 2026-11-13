function safeFormat(options: Intl.DateTimeFormatOptions, iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(language, options).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', options).format(date);
  }
}

export function formatTime(iso: string, language: string): string {
  return safeFormat({ hour: '2-digit', minute: '2-digit' }, iso, language);
}

export function formatDateTime(iso: string, language: string): string {
  return safeFormat(
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    iso,
    language,
  );
}

/** ISO strings are shown as readable dates; anything the person typed stays as typed. */
export function displayValue(value: string, language: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? formatDateTime(value, language) : value;
}

/** First and last characters of a long hash, so it fits on a phone but is still recognisable. */
export function shortHash(sha256: string): string {
  return sha256.length > 20 ? `${sha256.slice(0, 10)}…${sha256.slice(-8)}` : sha256;
}

export function minutesLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
}
