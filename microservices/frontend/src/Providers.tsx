import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { ConsentProvider } from '@/consent/ConsentProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

/** Everything the screens need around them. The server renders the public pages inside it too. */
export function Providers({ children }: { children: ReactNode }) {
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
          <ConsentProvider>{children}</ConsentProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
