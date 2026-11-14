import { createHistory } from './history';
import { createBrowserStorage, type KeyValueStorage } from './mock/storage';
import { SAMPLE_TEXT } from './samples';
import { ApiError, type ApiClient, type Entity, type FeedbackInput, type Scan } from './types';

export interface HttpApiOptions {
  fetch?: typeof fetch;
  storage?: KeyValueStorage;
}

/** The real backend (`docs/api-contract.md`). History is kept on this device, see ./history. */
export function createHttpApi(baseUrl: string, options: HttpApiOptions = {}): ApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  const send = options.fetch ?? ((...args) => fetch(...args));
  const history = createHistory(options.storage ?? createBrowserStorage());

  async function request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await send(`${base}${path}`, init);
    } catch {
      throw new ApiError('network', 'No connection');
    }
  }

  /** Turns a failed response into an error the screens understand. */
  function failure(response: Response, whenMissing: 'expired' | 'not_found'): Error {
    if (response.status === 400) return new ApiError('invalid_input', 'Not usable');
    if (response.status === 404) return new ApiError(whenMissing, 'Check not found');
    return new Error(`Server error ${response.status}`);
  }

  async function loadScan(response: Response, whenMissing: 'expired' | 'not_found'): Promise<Scan> {
    if (!response.ok) throw failure(response, whenMissing);
    return (await response.json()) as Scan;
  }

  async function remove(id: string): Promise<void> {
    const response = await request(`/v1/scans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw failure(response, 'not_found');
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
      history.add({ id: scan.id, kind: scan.kind, riskLevel: null, createdAt: scan.createdAt });
      return scan;
    },

    async getScan(id) {
      const response = await request(`/v1/scans/${encodeURIComponent(id)}`);
      // The server forgets a check after 15 minutes. If this device remembers it, it was deleted.
      const scan = await loadScan(response, history.has(id) ? 'expired' : 'not_found');
      if (scan.result) history.setRisk(id, scan.result.riskLevel);
      return scan;
    },

    async confirmEntities(id, entities: Entity[]) {
      const response = await request(`/v1/scans/${encodeURIComponent(id)}/entities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entities }),
      });
      return loadScan(response, 'expired');
    },

    listHistory: async () => history.list(),

    async deleteScan(id) {
      await remove(id);
      history.remove(id);
    },

    async deleteAllScans() {
      // Checks older than 15 minutes are already gone from the server; the rest are deleted now.
      await Promise.allSettled(history.list().map((item) => remove(item.id)));
      history.clear();
    },

    async sendFeedback(input: FeedbackInput) {
      const response = await request('/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw failure(response, 'not_found');
    },
  };
}
