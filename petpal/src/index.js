import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import reportWebVitals from './reportWebVitals';
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
                      <App />
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
