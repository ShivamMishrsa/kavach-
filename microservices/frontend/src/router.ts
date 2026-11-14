import { createBrowserRouter } from 'react-router';
import { routes } from '@/routes';

/** Only the browser builds this: the server renders from `routes` without a browser router. */
export const router = createBrowserRouter(routes);
