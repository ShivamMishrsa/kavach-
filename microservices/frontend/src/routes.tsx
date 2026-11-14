import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from '@/layouts/AppShell';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RootLayout, type RouteHandle } from '@/layouts/RootLayout';
import { SiteLayout } from '@/layouts/SiteLayout';
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

/** A public page: indexed by search engines, with its title taken from a translation key. */
function publicPage(importer: () => Promise<{ default: ComponentType }>, title: string) {
  return { ...page(importer), handle: { title } satisfies RouteHandle };
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          {
            element: <RedirectIfReady />,
            children: [
              { index: true, ...publicPage(() => import('@/pages/Landing'), 'app.tagline') },
            ],
          },
          { path: 'help', ...publicPage(() => import('@/pages/Help'), 'help.title') },
          {
            path: 'emergency',
            ...publicPage(() => import('@/pages/SentMoney'), 'sentMoney.title'),
          },
          { path: 'privacy', ...publicPage(() => import('@/pages/Legal'), 'site.privacy') },
          { path: 'terms', ...publicPage(() => import('@/pages/Legal'), 'site.terms') },
          { path: 'limitations', ...publicPage(() => import('@/pages/Legal'), 'site.limitations') },
        ],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: 'auth/verify', ...page(() => import('@/pages/AuthVerify')) },
          { path: 'auth/confirm-email', ...page(() => import('@/pages/AuthConfirmEmail')) },
          {
            element: <RedirectIfReady />,
            children: [{ path: 'start', ...page(() => import('@/pages/Welcome')) }],
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
              { path: 'share', ...page(() => import('@/pages/Share')) },
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
