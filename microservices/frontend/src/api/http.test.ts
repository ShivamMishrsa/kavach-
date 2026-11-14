import { beforeEach, describe, expect, it } from 'vitest';
import { createHttpApi } from './http';
import { createMemoryStorage } from './mock/storage';
import { SAMPLE_TEXT } from './samples';
import { ApiError, type DossierText, type Scan } from './types';

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

const words: DossierText = {
  title: 'Evidence summary',
  disclaimer: 'Not an FIR.',
  summaryTitle: 'What happened',
  summary: 'I received a scam message.',
  detailsTitle: 'Details',
  detailLabels: {
    utr: 'UTR',
    upi: 'UPI',
    phone: 'Phone',
    amount: 'Amount',
    datetime: 'Time',
    link: 'Link',
  },
  evidenceTitle: 'Fingerprints',
  evidenceHint: 'Shows the original was not changed.',
  capturedAt: 'Recorded {time}',
  keepOriginals: 'Keep your originals.',
  scriptTitle: 'What to say',
  script: 'Hello.',
};

describe('createDossier', () => {
  it('sends the words and returns a link that points at the backend', async () => {
    respond = () =>
      json(
        {
          url: '/v1/scans/abc/dossier.pdf?exp=1&sig=2',
          sha256: 'f'.repeat(64),
          generatedAt: 'now',
        },
        201,
      );
    const file = await api.createDossier('abc', words);
    expect(calls[0].url).toBe('http://api.test/v1/scans/abc/dossier');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual(words);
    expect(file.url).toBe('http://api.test/v1/scans/abc/dossier.pdf?exp=1&sig=2');
    expect(file.sha256).toBe('f'.repeat(64));
  });

  it('says "expired" when the check is gone and "invalid" when details were not confirmed', async () => {
    respond = () => json({}, 404);
    await expect(api.createDossier('abc', words)).rejects.toMatchObject({ code: 'expired' });
    respond = () => json({}, 400);
    await expect(api.createDossier('abc', words)).rejects.toMatchObject({ code: 'invalid_input' });
  });
});

describe('recordConsent', () => {
  it('posts the version and the choice', async () => {
    respond = () => new Response(null, { status: 204 });
    await api.recordConsent('2026-11-v1', true);
    expect(calls[0].url).toBe('http://api.test/v1/consent');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      version: '2026-11-v1',
      granted: true,
    });
  });
});

describe('limits', () => {
  it('reports too many tries as rate_limited', async () => {
    respond = () => json({ error: { code: 'rate_limited' } }, 429);
    await expect(api.createScan({ kind: 'link', url: 'example.com' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('reports a service that has reached its daily limit as busy', async () => {
    respond = () => json({ error: { code: 'busy' } }, 503);
    await expect(api.createScan({ kind: 'link', url: 'example.com' })).rejects.toMatchObject({
      code: 'busy',
    });
  });

  it('reports a body that was too big as invalid_input', async () => {
    respond = () => json({ error: { code: 'invalid_input' } }, 413);
    await expect(api.createScan({ kind: 'link', url: 'example.com' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});

const ACCOUNT = { id: 'usr_1', email: 'ravi@example.com', language: null, syncHistory: false };

/** Answers like the server: accounts for /v1/auth, 204 for history, a scan for everything else. */
function serve(account = ACCOUNT) {
  respond = ({ url, init }) => {
    if (url.includes('/v1/history')) return new Response(null, { status: 204 });
    if (url.includes('/v1/auth/profile')) {
      return json({ ...account, ...JSON.parse(init?.body as string) });
    }
    if (url.includes('/v1/auth')) return json(account);
    return json(scan(), 201);
  };
}

const historyCalls = () => calls.filter((call) => call.url.includes('/v1/history'));

describe('signing in', () => {
  it('sends the session cookie with every request', async () => {
    await api.createScan({ kind: 'link', url: 'example.com' });
    expect(calls.every((call) => call.init?.credentials === 'include')).toBe(true);
  });

  it('asks for a sign-in link in the language of the screen', async () => {
    respond = () => json({}, 202);
    await api.requestSignInLink('ravi@example.com', 'hi');
    expect(calls[0].url).toBe('http://api.test/v1/auth/magic-link');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      email: 'ravi@example.com',
      language: 'hi',
    });
  });

  it('reports a link that was too often asked for as rate_limited', async () => {
    respond = () => json({ error: { code: 'rate_limited' } }, 429);
    await expect(api.requestSignInLink('a@b.co', 'en')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('returns the account for a good link and says unauthorized for a bad one', async () => {
    serve();
    expect(await api.verifySignIn('x'.repeat(43))).toEqual(ACCOUNT);
    respond = () => json({ error: { code: 'unauthorized' } }, 401);
    await expect(api.verifySignIn('y'.repeat(43))).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('knows nobody is signed in when the server answers 401', async () => {
    respond = () => json({ error: { code: 'unauthorized' } }, 401);
    expect(await api.getAccount()).toBeNull();
  });

  it('signs out here or everywhere', async () => {
    respond = () => new Response(null, { status: 204 });
    await api.signOut(false);
    await api.signOut(true);
    expect(calls.map((call) => call.url)).toEqual([
      'http://api.test/v1/auth/logout',
      'http://api.test/v1/auth/logout-all',
    ]);
  });

  it('downloads the account data as a file', async () => {
    respond = () => new Response('{"account":{}}');
    expect(await (await api.exportAccount()).text()).toBe('{"account":{}}');
    expect(calls[0].url).toBe('http://api.test/v1/account/export');
  });

  it('deleting the account also forgets the history on this device', async () => {
    await api.createScan({ kind: 'link', url: 'example.com' });
    respond = () => new Response(null, { status: 204 });
    await api.deleteAccount();
    expect(calls.at(-1)?.init?.method).toBe('DELETE');
    expect(await api.listHistory()).toEqual([]);
  });
});

describe('history in the account', () => {
  it('stays on this device while sync is off', async () => {
    serve();
    await api.getAccount();
    await api.createScan({ kind: 'link', url: 'example.com' });
    expect(historyCalls()).toEqual([]);
    expect(await api.listHistory()).toHaveLength(1);
  });

  it('is copied to the account, and read from it, once sync is on', async () => {
    serve();
    await api.updateAccount({ syncHistory: true });
    await api.createScan({ kind: 'link', url: 'example.com' });
    expect(historyCalls().map((call) => call.init?.method)).toEqual(['PUT']);
    const sent = JSON.parse(historyCalls()[0].init?.body as string).items;
    expect(sent).toEqual([
      { id: 'abc', kind: 'notice', riskLevel: null, createdAt: '2026-11-13T10:00:00Z' },
    ]);

    respond = () => json([{ id: 'from-server', kind: 'link', riskLevel: 'low', createdAt: 'x' }]);
    expect((await api.listHistory())[0].id).toBe('from-server');
  });

  it('falls back to this device when the account cannot be reached', async () => {
    serve();
    await api.updateAccount({ syncHistory: true });
    await api.createScan({ kind: 'link', url: 'example.com' });
    respond = () => {
      throw new TypeError('offline');
    };
    expect(await api.listHistory()).toHaveLength(1);
  });

  it('never fails a check because the copy to the account failed', async () => {
    serve();
    await api.updateAccount({ syncHistory: true });
    respond = ({ url }) =>
      url.includes('/v1/history') ? new Response(null, { status: 500 }) : json(scan(), 201);
    await expect(api.createScan({ kind: 'link', url: 'example.com' })).resolves.toMatchObject({
      id: 'abc',
    });
  });

  it('deleting a check or all of them reaches the account too', async () => {
    serve();
    await api.updateAccount({ syncHistory: true });
    await api.createScan({ kind: 'link', url: 'example.com' });
    calls = [];
    respond = () => new Response(null, { status: 204 });
    await api.deleteScan('abc');
    await api.deleteAllScans();
    const deleted = calls.filter((call) => call.url.includes('/v1/history'));
    expect(deleted.map((call) => call.url)).toEqual([
      'http://api.test/v1/history/abc',
      'http://api.test/v1/history',
    ]);
  });

  it('uploads the checks remembered on this device in chunks', async () => {
    serve();
    for (let index = 0; index < 3; index++) {
      respond = () => json(scan({ id: `scan-id-${index}` }), 201);
      await api.createScan({ kind: 'link', url: 'example.com' });
    }
    serve();
    await api.updateAccount({ syncHistory: true });
    calls = [];
    await api.uploadHistory();
    expect(JSON.parse(calls[0].init?.body as string).items).toHaveLength(3);
  });

  it('stops copying after sign out', async () => {
    serve();
    await api.updateAccount({ syncHistory: true });
    respond = () => new Response(null, { status: 204 });
    await api.signOut(false);
    calls = [];
    respond = () => json(scan(), 201);
    await api.createScan({ kind: 'link', url: 'example.com' });
    expect(historyCalls()).toEqual([]);
  });
});

describe('email address and sign-ins', () => {
  it('asks for a link to the new address, in the language of the screen', async () => {
    respond = () => json({}, 202);
    await api.requestEmailChange('new@example.com', 'ta');
    expect(calls[0].url).toBe('http://api.test/v1/account/email');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      email: 'new@example.com',
      language: 'ta',
    });
  });

  it('returns the changed account for a good link and says unauthorized for a bad one', async () => {
    respond = () => json({ ...ACCOUNT, email: 'new@example.com' });
    expect((await api.confirmEmailChange('x'.repeat(43))).email).toBe('new@example.com');
    expect(calls[0].url).toBe('http://api.test/v1/account/email/confirm');
    respond = () => json({ error: { code: 'unauthorized' } }, 401);
    await expect(api.confirmEmailChange('y'.repeat(43))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('lists the sign-ins and ends one by its id', async () => {
    const rows = [{ id: 'abc123', createdAt: 'x', expiresAt: 'y', current: true }];
    respond = () => json(rows);
    expect(await api.listSignIns()).toEqual(rows);
    respond = () => new Response(null, { status: 204 });
    await api.endSignIn('abc/123');
    expect(calls.at(-1)?.url).toBe('http://api.test/v1/auth/sessions/abc%2F123');
    expect(calls.at(-1)?.init?.method).toBe('DELETE');
  });
});
