import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectionIsSlow, isLowData } from './lowData';

function phone(connection: object | undefined) {
  vi.stubGlobal('navigator', { connection });
}

afterEach(() => vi.unstubAllGlobals());

describe('saving data', () => {
  it('"on" always saves and "off" never does, whatever the network', () => {
    phone({ saveData: true, effectiveType: '2g' });
    expect(isLowData('off')).toBe(false);
    phone({ saveData: false, effectiveType: '4g' });
    expect(isLowData('on')).toBe(true);
  });

  it('"auto" follows the phone\'s Data Saver and a very slow network', () => {
    phone({ saveData: true, effectiveType: '4g' });
    expect(isLowData('auto')).toBe(true);
    phone({ saveData: false, effectiveType: 'slow-2g' });
    expect(isLowData('auto')).toBe(true);
    phone({ saveData: false, effectiveType: '2g' });
    expect(connectionIsSlow()).toBe(true);
  });

  it('"auto" does not save when the network is fine, or when the browser does not say', () => {
    phone({ saveData: false, effectiveType: '4g' });
    expect(isLowData('auto')).toBe(false);
    phone(undefined);
    expect(isLowData('auto')).toBe(false);
  });
});
