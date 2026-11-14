import { describe, expect, it } from 'vitest';
import {
  NORMAL,
  SAVING_DATA,
  fitWithin,
  planFor,
  shrinkImage,
  worthShrinking,
} from './compressImage';

describe('making a photo smaller before sending', () => {
  it('keeps the shape and brings the long side down to the limit', () => {
    expect(fitWithin(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(3000, 4000, 2400)).toEqual({ width: 1800, height: 2400 });
  });

  it('never makes a picture bigger', () => {
    expect(fitWithin(1080, 2400, 2400)).toBeNull();
    expect(fitWithin(800, 600, 2400)).toBeNull();
  });

  it('shrinks photos and screenshots that are large, and nothing else', () => {
    expect(worthShrinking({ type: 'image/jpeg', size: 5_000_000 }, NORMAL)).toBe(true);
    expect(worthShrinking({ type: 'image/png', size: 5_000_000 }, NORMAL)).toBe(true);
    expect(worthShrinking({ type: 'image/jpeg', size: 800_000 }, NORMAL)).toBe(false);
    expect(worthShrinking({ type: 'application/pdf', size: 9_000_000 }, NORMAL)).toBe(false);
    expect(worthShrinking({ type: 'image/gif', size: 9_000_000 }, NORMAL)).toBe(false);
  });

  it('saves more when data is short: smaller limit, lower quality, smaller files are shrunk too', () => {
    expect(planFor(false)).toBe(NORMAL);
    expect(planFor(true)).toBe(SAVING_DATA);
    expect(SAVING_DATA.maxEdge).toBeLessThan(NORMAL.maxEdge);
    expect(SAVING_DATA.quality).toBeLessThan(NORMAL.quality);
    expect(worthShrinking({ type: 'image/jpeg', size: 800_000 }, SAVING_DATA)).toBe(true);
  });

  it('sends the original when the browser cannot do it', async () => {
    // Node has no canvas or image decoder: the same path as an old phone browser.
    const file = new File([new Uint8Array(2_000_000)], 'notice.jpg', { type: 'image/jpeg' });
    expect(await shrinkImage(file, NORMAL)).toBe(file);
  });

  it('does not even try on a PDF', async () => {
    const file = new File([new Uint8Array(9_000_000)], 'notice.pdf', { type: 'application/pdf' });
    expect(await shrinkImage(file, SAVING_DATA)).toBe(file);
  });
});
