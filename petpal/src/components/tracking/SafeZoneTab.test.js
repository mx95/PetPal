import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SafeZoneTab from './SafeZoneTab';

const mockSave = jest.fn(() => Promise.resolve());
const mockDelete = jest.fn(() => Promise.resolve());

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key, vars) => (vars && vars.name ? `${key}:${vars.name}` : key),
  }),
}));
jest.mock('../../notifications/notificationsFirestore', () => ({
  DEFAULT_NOTIFICATION_PREFS: { push: true, zone: true, battery: true, sos: true, offline: true },
  saveSafeZone: (...args) => mockSave(...args),
  deleteSafeZone: (...args) => mockDelete(...args),
  subscribeNotificationPrefs: (_uid, cb) => {
    cb({ push: true, zone: true, battery: true, sos: true, offline: true });
    return () => {};
  },
  saveNotificationPrefs: jest.fn(),
  savePushToken: jest.fn(),
  deletePushToken: jest.fn(),
}));
jest.mock('../../notifications/pushMessaging', () => ({
  disablePush: jest.fn(),
  enablePush: jest.fn(),
  getPushPermission: () => 'default',
  hasLocalPushToken: () => false,
  isIosNeedingInstall: () => false,
  isPushSupported: () => Promise.resolve(true),
}));
jest.mock('../../tracking/PositionMap', () => ({
  __esModule: true,
  default: function MockMap({ safeZone, onMapClick }) {
    return (
      <button
        type="button"
        data-testid="map"
        data-zone={safeZone ? `${safeZone.lat.toFixed(4)},${safeZone.lng.toFixed(4)},${safeZone.radiusM}` : ''}
        onClick={() => onMapClick({ lat: 35.1, lng: 33.3 })}
      />
    );
  },
}));

const pet = { id: 'p1', name: 'Rex' };
const livePos = { lat: 34.7, lng: 33.0 };

describe('SafeZoneTab', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockDelete.mockClear();
  });

  test('creates a zone at the pet location, adjusts radius and saves it to the private doc', async () => {
    render(<SafeZoneTab pet={pet} imei="111111111111111" saved={null} loaded livePos={livePos} />);
    expect(screen.getByText('safeZone.none')).toBeTruthy();

    fireEvent.click(screen.getByText('safeZone.create'));
    expect(screen.getByTestId('map').dataset.zone).toBe('34.7000,33.0000,200');

    fireEvent.change(screen.getByRole('slider'), { target: { value: '350' } });
    fireEvent.click(screen.getByTestId('map'));
    expect(screen.getByTestId('map').dataset.zone).toBe('35.1000,33.3000,350');

    fireEvent.click(screen.getByText('safeZone.save'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith('u1', 'p1', {
      enabled: true,
      notifyExit: true,
      notifyEnter: true,
      radiusM: 350,
      lat: 35.1,
      lng: 33.3,
    });
  });

  test('shows the saved zone, disables save until edited, and can remove it', async () => {
    const saved = { enabled: true, lat: 34.7, lng: 33, radiusM: 150, notifyExit: true, notifyEnter: true };
    render(<SafeZoneTab pet={pet} imei="111111111111111" saved={saved} loaded livePos={livePos} />);
    expect(screen.getByTestId('map').dataset.zone).toBe('34.7000,33.0000,150');
    expect(screen.getByText('safeZone.save').disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('safeZone.notifyEnter'));
    expect(screen.getByText('safeZone.save').disabled).toBe(false);

    fireEvent.click(screen.getByText('safeZone.remove'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('u1', 'p1'));
  });

  test('warns when no tracker is linked', () => {
    render(<SafeZoneTab pet={pet} imei="" saved={null} loaded livePos={null} />);
    expect(screen.getByText('safeZone.noTracker')).toBeTruthy();
  });
});
