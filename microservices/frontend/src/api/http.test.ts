import { beforeEach, describe, expect, it } from 'vitest';
import { createHttpApi } from './http';
import { createMemoryStorage } from './mock/storage';
import { SAMPLE_TEXT } from './samples';
import { ApiError, type Scan } from './types';

interface Call {
  url: string;
  init?: RequestInit;
}

let calls: Call[];
let respond: (call: Call) => Response | Promise<Response>;
let storage = createMemoryStorage();
let api = makeApi();

function makeApi() {
  return createHttpApi('http://api.test/', {
    storage,
    fetch: async (url, init) => {
      const call = { url: String(url), init };
      calls.push(call);
      return respond(call);
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function scan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: 'abc',
    kind: 'notice',
    status: 'processing',
    stages: [],
    result: null,
    confirmedEntities: null,
    evidence: [],
    createdAt: '2026-11-13T10:00:00Z',
    expiresAt: '2026-11-13T10:15:00Z',
    simulated: false,
    ...overrides,
  };
}

function formOf(call: Call): FormData {
  return call.init?.body as FormData;
}

beforeEach(() => {
  calls = [];
  storage = createMemoryStorage();
  api = makeApi();
  respond = () => json(scan(), 201);
});

describe('createScan', () => {
  it('sends pasted text as a form and remembers the check on this device', async () => {
    const created = await api.createScan({ kind: 'notice', text: 'hello there' });
    expect(created.id).toBe('abc');
    expect(calls[0].url).toBe('http://api.test/v1/scans');
    expect(calls[0].init?.method).toBe('POST');
    expect(Object.fromEntries(formOf(calls[0]))).toEqual({ kind: 'notice', text: 'hello there' });
    expect(await api.listHistory()).toEqual([
      { id: 'abc', kind: 'notice', riskLevel: null, createdAt: '2026-11-13T10:00:00Z' },
    ]);
  });

  it('sends a file under its own name', async () => {
    const file = new File(['abc'], 'notice.png', { type: 'image/png' });
    await api.createScan({ kind: 'notice', file });
    const sent = formOf(calls[0]).get('file') as File;
    expect(sent.name).toBe('notice.png');
    expect(formOf(calls[0]).has('text')).toBe(false);
  });

  it('sends a link', async () => {
    await api.createScan({ kind: 'link', url: 'sbi.co.in' });
    expect(Object.fromEntries(formOf(calls[0]))).toEqual({ kind: 'link', url: 'sbi.co.in' });
  });

  it('sends a demo sample as its message text, so the real detection judges it', async () => {
    await api.createScan({ kind: 'notice', sampleId: 'fake_notice' });
    expect(formOf(calls[0]).get('text')).toBe(SAMPLE_TEXT.fake_notice);
  });

  it('reports an unusable input as invalid_input', async () => {
    respond = () => json({ error: { code: 'invalid_input' } }, 400);
    await expect(api.createScan({ kind: 'link', url: 'x' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(await api.listHistory()).toEqual([]);
  });

  it('reports an unreachable server as a network error', async () => {
    respond = () => {
      throw new TypeError('Failed to fetch');
    };
    const problem = await api.createScan({ kind: 'notice', text: 'a' }).catch((e: unknown) => e);
    expect(problem).toBeInstanceOf(ApiError);
    expect(problem).toMatchObject({ code: 'network' });
  });

  it('does not call a server fault "no connection"', async () => {
    respond = () => new Response('oops', { status: 500 });
    const problem = await api.createScan({ kind: 'notice', text: 'a' }).catch((e: unknown) => e);
    expect(problem).toBeInstanceOf(Error);
    expect(problem).not.toBeInstanceOf(ApiError);
  });
});

describe('getScan', () => {
  it('returns the scan and records its risk level in the history', async () => {
    await api.createScan({ kind: 'notice', text: 'hello there' });
    respond = () =>
      json(
        scan({
          status: 'done',
          result: { riskLevel: 'high', reasonCodes: [], entities: [], statutes: [] },
        }),
      );
    const done = await api.getScan('abc');
    expect(done.status).toBe('done');
    expect(calls.at(-1)?.url).toBe('http://api.test/v1/scans/abc');
    expect((await api.listHistory())[0].riskLevel).toBe('high');
  });

  it('says "expired" for a check this device remembers, "not found" otherwise', async () => {
    await api.createScan({ kind: 'notice', text: 'hello there' });
    respond = () => json({ error: { code: 'not_found' } }, 404);
    await expect(api.getScan('abc')).rejects.toMatchObject({ code: 'expired' });
    await expect(api.getScan('other')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('keeps ids safe inside the address', async () => {
    respond = () => json({}, 404);
    await api.getScan('a/b?c').catch(() => undefined);
    expect(calls[0].url).toBe('http://api.test/v1/scans/a%2Fb%3Fc');
  });
});

describe('confirmEntities', () => {
  it('sends the details as JSON', async () => {
    respond = () => json(scan({ status: 'done' }));
    await api.confirmEntities('abc', [{ type: 'utr', value: '400000000001' }]);
    expect(calls[0].url).toBe('http://api.test/v1/scans/abc/entities');
    expect(calls[0].init?.method).toBe('PUT');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      entities: [{ type: 'utr', value: '400000000001' }],
    });
  });

  it('says "expired" when the check is gone', async () => {
    respond = () => json({}, 404);
    await expect(api.confirmEntities('abc', [])).rejects.toMatchObject({ code: 'expired' });
  });
});

describe('deleting', () => {
  beforeEach(async () => {
    await api.createScan({ kind: 'notice', text: 'hello there' });
    respond = () => new Response(null, { status: 204 });
  });

  it('deletes a check on the server, then forgets it here', async () => {
    await api.deleteScan('abc');
    expect(calls.at(-1)?.init?.method).toBe('DELETE');
    expect(await api.listHistory()).toEqual([]);
  });

  it('keeps the history entry if the server could not be reached', async () => {
    respond = () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(api.deleteScan('abc')).rejects.toMatchObject({ code: 'network' });
    expect(await api.listHistory()).toHaveLength(1);
  });

  it('deletes every remembered check', async () => {
    respond = () => json(scan({ id: 'second', createdAt: '2026-11-13T10:05:00Z' }), 201);
    await api.createScan({ kind: 'notice', text: 'another one' });
    respond = () => new Response(null, { status: 204 });
    const before = calls.length;
    await api.deleteAllScans();
    expect(calls.slice(before).map((call) => call.url)).toEqual([
      'http://api.test/v1/scans/second',
      'http://api.test/v1/scans/abc',
    ]);
    expect(await api.listHistory()).toEqual([]);
  });
});

describe('history', () => {
  it('lists the newest check first', async () => {
    respond = () => json(scan({ id: 'old', createdAt: '2026-11-13T09:00:00Z' }), 201);
    await api.createScan({ kind: 'notice', text: 'older one' });
    respond = () => json(scan({ id: 'new', createdAt: '2026-11-13T11:00:00Z' }), 201);
    await api.createScan({ kind: 'link', url: 'example.com' });
    expect((await api.listHistory()).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('keeps only the id, kind, risk level and time', async () => {
    await api.createScan({ kind: 'notice', text: 'a very private message' });
    expect(Object.keys((await api.listHistory())[0]).sort()).toEqual(
      ['createdAt', 'id', 'kind', 'riskLevel'].sort(),
    );
    expect(storage.getItem('kavach.history')).not.toContain('private');
  });
});

describe('sendFeedback', () => {
  it('posts the choice and note', async () => {
    respond = () => new Response(null, { status: 204 });
    await api.sendFeedback({ scanId: 'abc', type: 'false_alarm', note: 'fine' });
    expect(calls[0].url).toBe('http://api.test/v1/feedback');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      scanId: 'abc',
      type: 'false_alarm',
      note: 'fine',
    });
  });

  it('fails when the server refuses it', async () => {
    respond = () => json({}, 400);
    await expect(api.sendFeedback({ scanId: 'abc', type: 'other' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});
