import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/types';
import {
  KEEP_MS,
  MAX_PENDING,
  createMemoryStore,
  freshChecks,
  saveCheck,
  sendCheck,
  toPending,
} from './queue';

const NOW = 1_800_000_000_000;
const link = { kind: 'link', url: 'http://sbi-kyc.example' } as const;

describe('checks kept for when there is a connection', () => {
  it('keeps a check and lists it, oldest first', async () => {
    const store = createMemoryStore();
    await saveCheck(store, { kind: 'notice', text: 'first' }, NOW);
    await saveCheck(store, link, NOW + 1000);
    const kept = await freshChecks(store, NOW + 2000);
    expect(kept.map((check) => check.input.kind)).toEqual(['notice', 'link']);
  });

  it('forgets a check after an hour, and deletes it, not just hides it', async () => {
    const store = createMemoryStore();
    await saveCheck(store, link, NOW);
    expect(await freshChecks(store, NOW + KEEP_MS - 1)).toHaveLength(1);
    expect(await freshChecks(store, NOW + KEEP_MS)).toHaveLength(0);
    expect(await store.list()).toHaveLength(0);
  });

  it('refuses a sixth check instead of keeping everything', async () => {
    const store = createMemoryStore();
    for (let i = 0; i < MAX_PENDING; i++) expect(await saveCheck(store, link, NOW)).not.toBeNull();
    expect(await saveCheck(store, link, NOW)).toBeNull();
    expect(await store.list()).toHaveLength(MAX_PENDING);
  });

  it('deletes a check once it was sent, and returns what the server answered', async () => {
    const store = createMemoryStore();
    const check = (await saveCheck(store, link, NOW))!;
    const outcome = await sendCheck(store, check, async () => ({ id: 'scan-1' }));
    expect(outcome).toEqual({ status: 'sent', value: { id: 'scan-1' } });
    expect(await store.list()).toHaveLength(0);
  });

  it.each(['network', 'busy', 'rate_limited'] as const)(
    'keeps a check for later when the problem is %s',
    async (code) => {
      const store = createMemoryStore();
      const check = (await saveCheck(store, link, NOW))!;
      const outcome = await sendCheck(store, check, async () => {
        throw new ApiError(code, 'x');
      });
      expect(outcome.status).toBe('later');
      expect(await store.list()).toHaveLength(1);
    },
  );

  it('deletes a check the server will never accept, so it does not come back every time', async () => {
    const store = createMemoryStore();
    const check = (await saveCheck(store, link, NOW))!;
    const outcome = await sendCheck(store, check, async () => {
      throw new ApiError('invalid_input', 'x');
    });
    expect(outcome.status).toBe('dropped');
    expect(await store.list()).toHaveLength(0);
  });

  it('clears everything at once', async () => {
    const store = createMemoryStore();
    await saveCheck(store, link, NOW);
    await saveCheck(store, { kind: 'notice', text: 'x' }, NOW);
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });

  it('keeps what the person typed or chose, and nothing for the demo samples', () => {
    expect(toPending({ kind: 'link', url: 'a.example' })).toEqual({
      kind: 'link',
      url: 'a.example',
    });
    expect(toPending({ kind: 'notice', text: 'hello' })).toEqual({ kind: 'notice', text: 'hello' });
    expect(toPending({ kind: 'notice', sampleId: 'fake_notice' })).toBeNull();
  });
});
