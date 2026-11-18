import { createHttpApi } from './http';
import { apiUrl, isMockApi } from './mode';
import { createMockApi } from './mock/mockApi';
import type { ApiClient } from './types';

export type * from './types';
export { ApiError } from './types';

/**
 * The app talks to the backend only through this client.
 * With VITE_API_URL set (see .env.example) it is the real backend. Without it, it is the
 * in-browser mock with simulated results, and the screens show demo mode.
 */
export { isMockApi };
export const api: ApiClient = apiUrl ? createHttpApi(apiUrl) : createMockApi();
