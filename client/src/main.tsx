import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import './index.css';
import App from './App.tsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { detectPlatform } from './lib/device';
import { AccessibilityProvider, useA11y } from './a11y/AccessibilityProvider';

const platform = detectPlatform();
document.documentElement.dataset.platform = platform;

function ThemedRoot() {
  const { resolvedColorScheme } = useA11y();

  return (
    <MaxUI platform={platform} colorScheme={resolvedColorScheme} resetBody>
      <App />
    </MaxUI>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AccessibilityProvider>
          <ThemedRoot />
        </AccessibilityProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
