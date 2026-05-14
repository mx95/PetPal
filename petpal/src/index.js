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
import { LostPetProvider } from './lostPet/LostPetContext';
import { PetsProvider } from './pets/PetsContext';
import { GameProvider } from './game/GameContext';
// eslint-disable-next-line no-unused-vars -- used in JSX; CRA can mis-report in CI
import { PublicWalkProvider } from './leaderboard/PublicWalkContext';
import { CommunityProvider } from './social/CommunityContext';
import { ToastProvider } from './components/Toast';

installGoogleMapsAuthFailureHook();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
        <AuthProvider>
          <CompanyProvider>
            <PetsProvider>
              <LostPetProvider>
                <GameProvider>
                  <PublicWalkProvider>
                    <CommunityProvider>
                      <ToastProvider>
                        <App />
                      </ToastProvider>
                    </CommunityProvider>
                  </PublicWalkProvider>
                </GameProvider>
              </LostPetProvider>
            </PetsProvider>
          </CompanyProvider>
        </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
