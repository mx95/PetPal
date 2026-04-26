import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { PetsProvider } from './pets/PetsContext';
import { GameProvider } from './game/GameContext';
import { PublicWalkProvider } from './leaderboard/PublicWalkContext';
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

import App from './App';

test('renders app name', () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <PetsProvider>
          <GameProvider>
            <PublicWalkProvider>
              <CommunityProvider>
                <App />
              </CommunityProvider>
            </PublicWalkProvider>
          </GameProvider>
        </PetsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
  expect(screen.getAllByText(/PetPal/i).length).toBeGreaterThan(0);
});
