import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConsentProvider } from '@/consent/ConsentProvider';
import { Toaster } from '@/components/ui/Toaster';
import { router } from '@/routes';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ConsentProvider>
            <RouterProvider router={router} />
            <Toaster />
          </ConsentProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
