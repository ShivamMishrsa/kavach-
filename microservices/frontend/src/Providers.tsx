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
        // "always": without a connection the library would wait instead of trying, and a check
        // would hang on "Checking" forever. Trying fails at once with a network error, which the
        // screens turn into a message (or into a check kept for later, see src/offline).
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, staleTime: 5_000, networkMode: 'always' },
          mutations: { networkMode: 'always' },
        },
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
