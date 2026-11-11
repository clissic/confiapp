// Sentry debe inicializarse antes que el resto de la app.
import './instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import { App } from './app/App';
import { AppErrorFallback } from './app/AppErrorFallback';
import './app/styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
