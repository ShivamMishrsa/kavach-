export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Copies text to the clipboard, with a fallback for browsers that block the Clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Uses the phone's share sheet when there is one, otherwise copies the text. Never shares files. */
export async function shareOrCopy(text: string, title?: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
