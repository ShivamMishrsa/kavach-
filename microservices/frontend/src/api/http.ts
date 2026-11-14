import { createHistory } from './history';
import { createBrowserStorage, type KeyValueStorage } from './mock/storage';
import { SAMPLE_TEXT } from './samples';
import {
  ApiError,
  type Account,
  type ApiClient,
  type DossierFile,
  type Entity,
  type FeedbackInput,
  type Scan,
  type ScanSummary,
  type SignIn,
} from './types';

export interface HttpApiOptions {
  fetch?: typeof fetch;
  storage?: KeyValueStorage;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const UPLOAD_CHUNK = 200;

/**
 * The real backend (`docs/api-contract.md`). The session is a cookie the browser keeps, so every
 * request is sent with credentials. History is kept on this device, and also in the account while
 * the person has sync turned on (see ./history).
 */
export function createHttpApi(baseUrl: string, options: HttpApiOptions = {}): ApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  const send = options.fetch ?? ((...args) => fetch(...args));
  const history = createHistory(options.storage ?? createBrowserStorage());
  /** Whether the signed-in person has history sync on. Learnt from every account answer. */
  let syncing = false;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await send(`${base}${path}`, { credentials: 'include', ...init });
    } catch {
      throw new ApiError('network', 'No connection');
    }
  }

  const sendJson = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** Turns a failed response into an error the screens understand. */
  function failure(response: Response, whenMissing: 'expired' | 'not_found'): Error {
    if (response.status === 400 || response.status === 413) {
      return new ApiError('invalid_input', 'Not usable');
    }
    if (response.status === 401) return new ApiError('unauthorized', 'Not signed in');
    if (response.status === 403) return new ApiError('forbidden', 'Not allowed');
    if (response.status === 429) return new ApiError('rate_limited', 'Too many tries');
    if (response.status === 503) return new ApiError('busy', 'Very busy');
    if (response.status === 404) return new ApiError(whenMissing, 'Check not found');
    return new Error(`Server error ${response.status}`);
  }

  async function loadScan(response: Response, whenMissing: 'expired' | 'not_found'): Promise<Scan> {
    if (!response.ok) throw failure(response, whenMissing);
    return (await response.json()) as Scan;
  }

  async function loadAccount(response: Response): Promise<Account> {
    if (!response.ok) throw failure(response, 'not_found');
    const account = (await response.json()) as Account;
    syncing = account.syncHistory;
    return account;
  }

  async function expectOk(response: Response): Promise<void> {
    if (!response.ok) throw failure(response, 'not_found');
  }

  async function removeScan(id: string): Promise<void> {
    await expectOk(await request(`/v1/scans/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  }

  /** Copies history items into the account. The scan itself never depends on this working. */
  async function pushHistory(items: ScanSummary[]): Promise<void> {
    if (!syncing) return;
    for (let start = 0; start < items.length; start += UPLOAD_CHUNK) {
      const chunk = items.slice(start, start + UPLOAD_CHUNK);
      await sendJson('/v1/history', 'PUT', { items: chunk }).catch(() => undefined);
    }
  }

  async function dropHistory(path: string): Promise<void> {
    if (syncing) await sendJson(path, 'DELETE').catch(() => undefined);
  }

  return {
    async createScan(input) {
      const form = new FormData();
      form.set('kind', input.kind);
      if (input.kind === 'link') {
        form.set('url', input.url);
      } else if (input.file) {
        form.set('file', input.file);
      } else {
        form.set('text', input.sampleId ? SAMPLE_TEXT[input.sampleId] : (input.text ?? ''));
      }
      const scan = await loadScan(
        await request('/v1/scans', { method: 'POST', body: form }),
        'not_found',
      );
      const item = { id: scan.id, kind: scan.kind, riskLevel: null, createdAt: scan.createdAt };
      history.add(item);
      await pushHistory([item]);
      return scan;
    },

    async getScan(id) {
      const response = await request(`/v1/scans/${encodeURIComponent(id)}`);
      // The server forgets a check after 15 minutes. If this device remembers it, it was deleted.
      const scan = await loadScan(response, history.has(id) ? 'expired' : 'not_found');
      const known = history.list().find((item) => item.id === id);
      if (scan.result && known && known.riskLevel !== scan.result.riskLevel) {
        history.setRisk(id, scan.result.riskLevel);
        await pushHistory([{ ...known, riskLevel: scan.result.riskLevel }]);
      }
      return scan;
    },

    async confirmEntities(id, entities: Entity[]) {
      const response = await sendJson(`/v1/scans/${encodeURIComponent(id)}/entities`, 'PUT', {
        entities,
      });
      return loadScan(response, 'expired');
    },

    async listHistory() {
      if (syncing) {
        const response = await request('/v1/history').catch(() => null);
        if (response?.ok) return (await response.json()) as ScanSummary[];
      }
      return history.list();
    },

    async deleteScan(id) {
      await removeScan(id);
      history.remove(id);
      await dropHistory(`/v1/history/${encodeURIComponent(id)}`);
    },

    async deleteAllScans() {
      // Checks older than 15 minutes are already gone from the server; the rest are deleted now.
      await Promise.allSettled(history.list().map((item) => removeScan(item.id)));
      history.clear();
      await dropHistory('/v1/history');
    },

    async createDossier(id, text) {
      const response = await sendJson(`/v1/scans/${encodeURIComponent(id)}/dossier`, 'POST', text);
      if (!response.ok) throw failure(response, 'expired');
      const file = (await response.json()) as DossierFile;
      return { ...file, url: `${base}${file.url}` };
    },

    async recordConsent(version, granted) {
      await expectOk(await sendJson('/v1/consent', 'POST', { version, granted }));
    },

    async sendFeedback(input: FeedbackInput) {
      await expectOk(await sendJson('/v1/feedback', 'POST', input));
    },

    async requestSignInLink(email, language) {
      await expectOk(await sendJson('/v1/auth/magic-link', 'POST', { email, language }));
    },

    async verifySignIn(token) {
      return loadAccount(await sendJson('/v1/auth/verify', 'POST', { token }));
    },

    async getAccount() {
      const response = await request('/v1/auth/me');
      if (response.status === 401) {
        syncing = false;
        return null;
      }
      return loadAccount(response);
    },

    async updateAccount(patch) {
      return loadAccount(await sendJson('/v1/auth/profile', 'PUT', patch));
    },

    async signOut(everywhere) {
      await expectOk(
        await sendJson(everywhere ? '/v1/auth/logout-all' : '/v1/auth/logout', 'POST'),
      );
      syncing = false;
    },

    async requestEmailChange(email, language) {
      await expectOk(await sendJson('/v1/account/email', 'POST', { email, language }));
    },

    async confirmEmailChange(token) {
      return loadAccount(await sendJson('/v1/account/email/confirm', 'POST', { token }));
    },

    async listSignIns() {
      const response = await request('/v1/auth/sessions');
      if (!response.ok) throw failure(response, 'not_found');
      return (await response.json()) as SignIn[];
    },

    async endSignIn(id) {
      await expectOk(await sendJson(`/v1/auth/sessions/${encodeURIComponent(id)}`, 'DELETE'));
    },

    async exportAccount() {
      const response = await request('/v1/account/export');
      if (!response.ok) throw failure(response, 'not_found');
      return response.blob();
    },

    async deleteAccount() {
      await expectOk(await sendJson('/v1/account', 'DELETE'));
      syncing = false;
      history.clear();
    },

    async uploadHistory() {
      await pushHistory(history.list());
    },
  };
}
