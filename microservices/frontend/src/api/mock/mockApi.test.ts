import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../types';
import { createMemoryStorage } from './storage';
import { MAX_FILE_BYTES, TTL_MS, createMockApi } from './mockApi';

let clock = 1_000_000;
let storage = createMemoryStorage();
let api = makeApi();

function makeApi() {
  return createMockApi({
    storage,
    now: () => clock,
    stageMs: [100, 200, 300, 400],
    latencyMs: 0,
  });
}

beforeEach(() => {
  clock = 1_000_000;
  storage = createMemoryStorage();
  api = makeApi();
});

describe('scan progress', () => {
  it('advances through the stages and hides the result until done', async () => {
    const scan = await api.createScan({ kind: 'notice', sampleId: 'fake_notice' });
    expect(scan.status).toBe('processing');
    expect(scan.result).toBeNull();
    expect(scan.stages.map((s) => s.status)).toEqual(['current', 'waiting', 'waiting', 'waiting']);

    clock += 250;
    const mid = await api.getScan(scan.id);
    expect(mid.stages.map((s) => s.status)).toEqual(['done', 'done', 'current', 'waiting']);
    expect(mid.result).toBeNull();

    clock += 200;
    const done = await api.getScan(scan.id);
    expect(done.status).toBe('done');
    expect(done.stages.every((s) => s.status === 'done')).toBe(true);
    expect(done.result?.riskLevel).toBe('very_high');
  });

  it('marks every scan as simulated while this is the mock', async () => {
    const scan = await api.createScan({ kind: 'notice', sampleId: 'bank_alert' });
    expect(scan.simulated).toBe(true);
  });
});

describe('evidence', () => {
  it('records the real SHA-256 of pasted text', async () => {
    const scan = await api.createScan({ kind: 'notice', text: 'abc' });
    expect(scan.evidence[0]).toMatchObject({
      name: 'pasted-text.txt',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    expect(scan.evidence[0].capturedAt).toBe(new Date(clock).toISOString());
  });

  it('records the real SHA-256 of an uploaded file', async () => {
    const file = new File(['hello'], 'notice.png', { type: 'image/png' });
    const scan = await api.createScan({ kind: 'notice', file });
    expect(scan.evidence[0].name).toBe('notice.png');
    expect(scan.evidence[0].sha256).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});

describe('15-minute deletion', () => {
  it('deletes the scan after the TTL but keeps only metadata in history', async () => {
    const scan = await api.createScan({ kind: 'notice', sampleId: 'fake_notice' });
    clock += 1000;
    expect((await api.getScan(scan.id)).result).not.toBeNull();

    clock += TTL_MS;
    await expect(api.getScan(scan.id)).rejects.toMatchObject({ code: 'expired' });

    const history = await api.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      id: scan.id,
      kind: 'notice',
      riskLevel: 'very_high',
      createdAt: scan.createdAt,
    });
    expect(storage.getItem('kavach.mock.scans')).toBe('{}');
  });

  it('reports an unknown id as not found', async () => {
    await expect(api.getScan('scn_missing')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('validation', () => {
  it('rejects an invalid link', async () => {
    await expect(api.createScan({ kind: 'link', url: 'not a link' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('rejects a notice with nothing in it', async () => {
    await expect(api.createScan({ kind: 'notice' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    await expect(api.createScan({ kind: 'notice', text: '   ' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('rejects a file over the size limit', async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'big.png', { type: 'image/png' });
    await expect(api.createScan({ kind: 'notice', file: big })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

describe('details and history', () => {
  it('stores confirmed details trimmed and without empty ones', async () => {
    const scan = await api.createScan({ kind: 'notice', sampleId: 'fake_notice' });
    clock += 1000;
    const updated = await api.confirmEntities(scan.id, [
      { type: 'utr', value: '  400000000099 ' },
      { type: 'upi', value: '   ' },
    ]);
    expect(updated.confirmedEntities).toEqual([{ type: 'utr', value: '400000000099' }]);
  });

  it('lists history newest first and supports deleting one or all', async () => {
    const first = await api.createScan({ kind: 'link', url: 'https://example.org' });
    clock += 5000;
    const second = await api.createScan({ kind: 'link', url: 'http://example.org' });

    const list = await api.listHistory();
    expect(list.map((item) => item.id)).toEqual([second.id, first.id]);

    await api.deleteScan(second.id);
    expect((await api.listHistory()).map((item) => item.id)).toEqual([first.id]);
    await expect(api.getScan(second.id)).rejects.toMatchObject({ code: 'not_found' });

    await api.deleteAllScans();
    expect(await api.listHistory()).toEqual([]);
  });

  it('keeps feedback short', async () => {
    const scan = await api.createScan({ kind: 'link', url: 'https://example.org' });
    await api.sendFeedback({ scanId: scan.id, type: 'false_alarm', note: 'x'.repeat(900) });
    const saved = JSON.parse(storage.getItem('kavach.mock.feedback') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].note).toHaveLength(500);
  });
});
