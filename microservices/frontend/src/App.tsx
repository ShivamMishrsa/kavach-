import type { ComponentProps } from 'react';
import { RouterProvider } from 'react-router';
import { Providers } from '@/Providers';
import { Toaster } from '@/components/ui/Toaster';
import { PwaUpdates } from '@/pwa/PwaUpdates';

export default function App({
  router,
}: {
  router: ComponentProps<typeof RouterProvider>['router'];
}) {
  return (
    <Providers>
      <RouterProvider router={router} />
      <Toaster />
      <PwaUpdates />
    </Providers>
  );
}
