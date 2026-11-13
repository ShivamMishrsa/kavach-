import {
  ApiError,
  type ApiClient,
  type Entity,
  type EvidenceHash,
  type FeedbackInput,
  type Scan,
  type ScanInput,
  type ScanKind,
  type ScanResult,
  type ScanSummary,
  type StageId,
  type StageProgress,
} from '../types';
import { analyzeLink, analyzeText, sampleResult, simulatedUploadResult } from './analyze';
import { newId, sha256File, sha256Text } from './hash';
import { createBrowserStorage, type KeyValueStorage } from './storage';

const SCANS_KEY = 'kavach.mock.scans';
const HISTORY_KEY = 'kavach.mock.history';
const FEEDBACK_KEY = 'kavach.mock.feedback';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const TTL_MS = 15 * 60_000;

const STAGE_ORDER: StageId[] = ['received', 'read', 'signals', 'report'];

export interface MockApiOptions {
  storage?: KeyValueStorage;
  now?: () => number;
  /** Time (ms since the scan started) at which each stage is finished. */
  stageMs?: [number, number, number, number];
  latencyMs?: number;
}

interface StoredScan {
  id: string;
  kind: ScanKind;
  startedAt: number;
  createdAt: string;
  expiresAt: string;
  result: ScanResult;
  confirmedEntities: Entity[] | null;
  evidence: EvidenceHash[];
}

function read<T>(storage: KeyValueStorage, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * In-browser stand-in for the backend. Behaves like the real service will:
 * stages advance over time, scans (and their details) are deleted after 15 minutes,
 * and only metadata is kept in history.
 */
export function createMockApi(options: MockApiOptions = {}): ApiClient {
  const storage = options.storage ?? createBrowserStorage();
  const now = options.now ?? Date.now;
  const stageMs = options.stageMs ?? [600, 1800, 3400, 4600];
  const latencyMs = options.latencyMs ?? 150;

  const pause = () =>
    latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  const loadScans = () => read<Record<string, StoredScan>>(storage, SCANS_KEY, {});
  const saveScans = (scans: Record<string, StoredScan>) =>
    storage.setItem(SCANS_KEY, JSON.stringify(scans));
  const loadHistory = () => read<ScanSummary[]>(storage, HISTORY_KEY, []);
  const saveHistory = (items: ScanSummary[]) => storage.setItem(HISTORY_KEY, JSON.stringify(items));

  /** Deletes expired scans: this is the 15-minute deletion, applied on every access. */
  function purge(): Record<string, StoredScan> {
    const scans = loadScans();
    const current = now();
    let changed = false;
    for (const [id, scan] of Object.entries(scans)) {
      if (current >= Date.parse(scan.expiresAt)) {
        delete scans[id];
        changed = true;
      }
    }
    if (changed) saveScans(scans);
    return scans;
  }

  function toScan(stored: StoredScan): Scan {
    const elapsed = now() - stored.startedAt;
    const finished = stageMs.map((limit) => elapsed >= limit);
    const firstOpen = finished.indexOf(false);
    const stages: StageProgress[] = STAGE_ORDER.map((id, index) => ({
      id,
      status: finished[index] ? 'done' : index === firstOpen ? 'current' : 'waiting',
    }));
    const done = firstOpen === -1;
    return {
      id: stored.id,
      kind: stored.kind,
      status: done ? 'done' : 'processing',
      stages,
      result: done ? stored.result : null,
      confirmedEntities: done ? stored.confirmedEntities : null,
      evidence: stored.evidence,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
      simulated: true,
    };
  }

  async function analyze(
    input: ScanInput,
  ): Promise<{ result: ScanResult; evidence: EvidenceHash[] }> {
    const clock = new Date(now());
    const capturedAt = clock.toISOString();

    if (input.kind === 'link') {
      const result = analyzeLink(input.url);
      if (!result) throw new ApiError('invalid_input', 'Not a valid web address');
      const link = result.entities[0].value;
      return {
        result,
        evidence: [{ name: 'link.txt', sha256: await sha256Text(link), capturedAt }],
      };
    }

    if (input.sampleId) {
      return {
        result: sampleResult(input.sampleId, clock),
        evidence: [
          {
            name: `${input.sampleId}.sample`,
            sha256: await sha256Text(`sample:${input.sampleId}`),
            capturedAt,
          },
        ],
      };
    }

    if (input.file) {
      if (input.file.size > MAX_FILE_BYTES) throw new ApiError('invalid_input', 'File too large');
      const hash = await sha256File(input.file);
      return {
        result: simulatedUploadResult(hash, clock),
        evidence: [{ name: input.file.name, sha256: hash, capturedAt }],
      };
    }

    if (input.text && input.text.trim().length > 0) {
      return {
        result: analyzeText(input.text, clock),
        evidence: [{ name: 'pasted-text.txt', sha256: await sha256Text(input.text), capturedAt }],
      };
    }

    throw new ApiError('invalid_input', 'Nothing to check');
  }

  return {
    async createScan(input) {
      await pause();
      const { result, evidence } = await analyze(input);
      const start = now();
      const stored: StoredScan = {
        id: newId('scn'),
        kind: input.kind,
        startedAt: start,
        createdAt: new Date(start).toISOString(),
        expiresAt: new Date(start + TTL_MS).toISOString(),
        result,
        confirmedEntities: null,
        evidence,
      };
      const scans = purge();
      scans[stored.id] = stored;
      saveScans(scans);
      saveHistory([
        {
          id: stored.id,
          kind: stored.kind,
          riskLevel: result.riskLevel,
          createdAt: stored.createdAt,
        },
        ...loadHistory(),
      ]);
      return toScan(stored);
    },

    async getScan(id) {
      await pause();
      const stored = purge()[id];
      if (stored) return toScan(stored);
      throw loadHistory().some((item) => item.id === id)
        ? new ApiError('expired', 'This check has been deleted')
        : new ApiError('not_found', 'Check not found');
    },

    async confirmEntities(id, entities) {
      await pause();
      const scans = purge();
      const stored = scans[id];
      if (!stored) throw new ApiError('expired', 'This check has been deleted');
      stored.confirmedEntities = entities
        .map((entity) => ({ type: entity.type, value: entity.value.trim() }))
        .filter((entity) => entity.value !== '');
      saveScans(scans);
      return toScan(stored);
    },

    async listHistory() {
      await pause();
      return [...loadHistory()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async deleteScan(id) {
      await pause();
      const scans = loadScans();
      delete scans[id];
      saveScans(scans);
      saveHistory(loadHistory().filter((item) => item.id !== id));
    },

    async deleteAllScans() {
      await pause();
      storage.removeItem(SCANS_KEY);
      storage.removeItem(HISTORY_KEY);
    },

    async sendFeedback(input: FeedbackInput) {
      await pause();
      const all = read<FeedbackInput[]>(storage, FEEDBACK_KEY, []);
      all.push({ scanId: input.scanId, type: input.type, note: input.note?.slice(0, 500) });
      storage.setItem(FEEDBACK_KEY, JSON.stringify(all));
    },
  };
}
