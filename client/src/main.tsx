import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { applyTheme, getThemeChoice, watchSystemTheme } from '@/lib/theme';
// Self-hosted fonts (no Google Fonts request): faster first paint and no third-party tracking.
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';

applyTheme(getThemeChoice());
watchSystemTheme();

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
