import { createHttpApi } from './http';
import { createMockApi } from './mock/mockApi';
import type { ApiClient } from './types';

export type * from './types';
export { ApiError } from './types';

/**
 * The app talks to the backend only through this client.
 * With VITE_API_URL set (see .env.example) it is the real backend. Without it, it is the
 * in-browser mock with simulated results, and the screens show demo mode.
 */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const isMockApi = !apiUrl;
export const api: ApiClient = apiUrl ? createHttpApi(apiUrl) : createMockApi();
