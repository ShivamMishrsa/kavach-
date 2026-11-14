import { RouterProvider } from 'react-router';
import { Providers } from '@/Providers';
import { Toaster } from '@/components/ui/Toaster';
import { router } from '@/router';

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <Toaster />
    </Providers>
  );
}
