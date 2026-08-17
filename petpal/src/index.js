import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.generated.css';
import './index.css';
import { installGoogleMapsAuthFailureHook } from './config/googleMapsAuthFailure';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';

installGoogleMapsAuthFailureHook();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    schedule(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  });
}
