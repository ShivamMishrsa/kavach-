import { Toaster } from '@/components/ui/Toaster';
import DesignSystem from '@/pages/DesignSystem';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider>
      <DesignSystem />
      <Toaster />
    </ThemeProvider>
  );
}
