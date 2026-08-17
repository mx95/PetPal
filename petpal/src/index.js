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
import { CompanyProvider } from './company/CompanyContext';
import { PetsProvider } from './pets/PetsContext';
import { ToastProvider } from './components/Toast';
import { InboxProvider } from './inbox/InboxContext';
import { ShopCartProvider } from './shop/ShopCartContext';

installGoogleMapsAuthFailureHook();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
        <AuthProvider>
          <CompanyProvider>
            <InboxProvider>
            <ShopCartProvider>
            <PetsProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </PetsProvider>
            </ShopCartProvider>
            </InboxProvider>
          </CompanyProvider>
        </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
