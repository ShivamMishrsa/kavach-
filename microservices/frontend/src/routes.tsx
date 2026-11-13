import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/layouts/AppShell';
import { PublicLayout } from '@/layouts/PublicLayout';
import {
  RedirectIfReady,
  RedirectIfUser,
  RequireOnboarded,
  RequireSessionOnly,
} from '@/layouts/guards';
import RootError from '@/pages/RootError';

/** Pages are loaded only when visited, which keeps the first load small on slow phones. */
function page(importer: () => Promise<{ default: ComponentType }>) {
  return { lazy: async () => ({ Component: (await importer()).default }) };
}

export const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <RootError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            element: <RedirectIfReady />,
            children: [{ index: true, ...page(() => import('@/pages/Welcome')) }],
          },
          {
            element: <RedirectIfUser />,
            children: [
              { path: 'login', ...page(() => import('@/pages/Login')) },
              { path: 'signup', ...page(() => import('@/pages/Signup')) },
            ],
          },
        ],
      },
      {
        element: <RequireSessionOnly />,
        children: [
          {
            element: <PublicLayout />,
            children: [{ path: 'language', ...page(() => import('@/pages/ChooseLanguage')) }],
          },
        ],
      },
      {
        path: 'app',
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, ...page(() => import('@/pages/Home')) },
              { path: 'scan/notice', ...page(() => import('@/pages/ScanNotice')) },
              { path: 'scan/link', ...page(() => import('@/pages/ScanLink')) },
              { path: 'scan/voice', ...page(() => import('@/pages/ScanVoice')) },
              { path: 'scan/:id', ...page(() => import('@/pages/ScanView')) },
              { path: 'scan/:id/details', ...page(() => import('@/pages/ScanDetails')) },
              { path: 'scan/:id/dossier', ...page(() => import('@/pages/Dossier')) },
              { path: 'sent-money', ...page(() => import('@/pages/SentMoney')) },
              { path: 'history', ...page(() => import('@/pages/History')) },
              { path: 'help', ...page(() => import('@/pages/Help')) },
              { path: 'settings', ...page(() => import('@/pages/Settings')) },
            ],
          },
        ],
      },
      { path: 'design', ...page(() => import('@/pages/DesignSystem')) },
      { path: '*', ...page(() => import('@/pages/NotFound')) },
    ],
  },
];

export const router = createBrowserRouter(routes);
