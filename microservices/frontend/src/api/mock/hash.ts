function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Real SHA-256 computed in the browser (the same hash the backend will record in Step 5). */
export async function sha256Bytes(bytes: Uint8Array<ArrayBuffer> | ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

export async function sha256File(file: File): Promise<string> {
  return sha256Bytes(await file.arrayBuffer());
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
