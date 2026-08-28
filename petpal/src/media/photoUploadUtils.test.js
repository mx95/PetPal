import {
  normalizePrimaryPhoto,
  pickPrimaryPhotoUrl,
  validatePhotoFile,
} from './photoUploadUtils';

describe('photoUploadUtils', () => {
  it('validates image type and size', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true });
    expect(validatePhotoFile({ type: 'text/plain', size: 1000 })).toEqual({ ok: false, code: 'type' });
    expect(validatePhotoFile({ type: 'image/png', size: 20 * 1024 * 1024 })).toEqual({ ok: true });
    expect(validatePhotoFile({ type: 'image/png', size: 30 * 1024 * 1024 })).toEqual({ ok: false, code: 'size' });
  });

  it('normalizes primary photo to first when missing', () => {
    const out = normalizePrimaryPhoto([
      { id: 'a', previewUrl: 'a' },
      { id: 'b', previewUrl: 'b' },
    ]);
    expect(out[0].isPrimary).toBe(true);
    expect(out[1].isPrimary).toBe(false);
  });

  it('picks primary photo url', () => {
    expect(
      pickPrimaryPhotoUrl([
        { url: 'one', isPrimary: false },
        { url: 'two', isPrimary: true },
      ])
    ).toBe('two');
  });
});
