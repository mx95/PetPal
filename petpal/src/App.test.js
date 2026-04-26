import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { CompanyProvider } from './company/CompanyContext';
import { PetsProvider } from './pets/PetsContext';
import { GameProvider } from './game/GameContext';
import { PublicWalkProvider } from './leaderboard/PublicWalkContext';
import { LostPetProvider } from './lostPet/LostPetContext';
import { CommunityProvider } from './social/CommunityContext';

jest.mock('./tracking/PositionMap', () => {
  return function MockPositionMap() {
    return <div data-testid="position-map-mock" />;
  };
});

jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
  Marker: () => null,
  InfoWindow: () => null,
}));

jest.mock('./company/LocationPicker', () => ({
  __esModule: true,
  default: function MockLocationPicker() {
    return <div data-testid="location-picker" />;
  },
  defaultMapCenter: { lat: 35.17, lng: 33.36 },
}));

import App from './App';

test('renders app name', () => {
  render(
    <BrowserRouter>
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
    </BrowserRouter>
  );
  expect(screen.getAllByText(/PetPal/i).length).toBeGreaterThan(0);
});
