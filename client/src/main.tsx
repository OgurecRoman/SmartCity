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

const platform = detectPlatform();
document.documentElement.dataset.platform = platform;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {/*
          platform — iOS/Android по устройству.
          colorScheme не задаём: MaxUI сам берёт системную тему и слушает её смену.
        */}
        <MaxUI platform={platform} resetBody>
          <App />
        </MaxUI>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
