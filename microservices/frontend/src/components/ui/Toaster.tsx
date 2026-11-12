import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/theme/ThemeProvider';

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return <Sonner theme={resolvedTheme} position="top-center" />;
}
