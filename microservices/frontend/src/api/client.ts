import { createMockApi } from './mock/mockApi';
import type { ApiClient } from './types';

export type * from './types';
export { ApiError } from './types';

/**
 * The app talks to the backend only through this client.
 * Until the real backend exists (Step 4) it is the in-browser mock, and the UI shows demo mode.
 */
export const isMockApi = true;
export const api: ApiClient = createMockApi();
