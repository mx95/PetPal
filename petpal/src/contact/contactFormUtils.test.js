import {
  contactMailtoHref,
  mapContactCallableError,
  normalizeContactPayload,
  validateContactPayload,
} from './contactFormUtils';

describe('validateContactPayload', () => {
  it('rejects short subject and message', () => {
    expect(
      validateContactPayload({ name: 'Ada', email: 'ada@example.com', subject: 'Hi', message: 'Hello' })
    ).toBe('contactPage.errSubject');
    expect(
      validateContactPayload({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Collar help',
        message: 'too short',
      })
    ).toBe('contactPage.errMessage');
  });

  it('accepts a complete support message', () => {
    expect(
      validateContactPayload({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Collar GPS',
        message: 'The tracker stopped updating this morning.',
      })
    ).toBe('');
  });
});

describe('mapContactCallableError', () => {
  it('maps missing function to a friendly unavailable key', () => {
    expect(mapContactCallableError({ code: 'functions/not-found', message: 'NOT FOUND' })).toBe(
      'contactPage.errUnavailable'
    );
  });
});

describe('contactMailtoHref', () => {
  it('builds a mailto fallback', () => {
    const href = contactMailtoHref(
      { name: 'Ada', email: 'ada@example.com', subject: 'Help', message: 'Need a hand' },
      'info@petpal.com.cy'
    );
    expect(href.startsWith('mailto:info@petpal.com.cy?')).toBe(true);
    expect(href).toContain('Help');
  });
});

describe('normalizeContactPayload', () => {
  it('trims fields', () => {
    expect(normalizeContactPayload({ name: '  Ada  ', email: ' a@b.co ', subject: ' x ', message: ' y ' })).toEqual({
      name: 'Ada',
      email: 'a@b.co',
      subject: 'x',
      message: 'y',
    });
  });
});
