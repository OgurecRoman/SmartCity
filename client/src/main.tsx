import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import './index.css';
import App from './App.tsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <MaxUI platform="ios" colorScheme="light" resetBody>
          <App />
        </MaxUI>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
