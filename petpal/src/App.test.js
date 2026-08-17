import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';

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
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
  expect(screen.getAllByText(/PetPal/i).length).toBeGreaterThan(0);
});
