import { extractImeiFromQr } from './extractImeiFromQr';

describe('extractImeiFromQr', () => {
  it('reads plain 15-digit IMEI from barcode', () => {
    expect(extractImeiFromQr('359232049112738')).toBe('359232049112738');
  });

  it('reads IMEI with label prefix', () => {
    expect(extractImeiFromQr('IMEI:359232049112738')).toBe('359232049112738');
  });

  it('reads IMEI with spaces', () => {
    expect(extractImeiFromQr('359 232 049 112 738')).toBe('359232049112738');
  });
});
