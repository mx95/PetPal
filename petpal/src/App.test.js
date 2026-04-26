import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';

jest.mock('./tracking/PositionMap', () => {
  return function MockPositionMap() {
    return <div data-testid="position-map-mock" />;
  };
});

import App from './App';

test('renders app name', () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  );
  expect(screen.getAllByText(/PetPal/i).length).toBeGreaterThan(0);
});
