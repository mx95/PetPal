import { mergeInboxMessages, countUnreadInboxMessages } from './inboxMerge';

describe('mergeInboxMessages', () => {
  test('merges broadcast and personal messages newest first', () => {
    const merged = mergeInboxMessages(
      [{ id: 'b1', title: 'Broadcast', body: 'Hello', createdAt: '2026-01-01T10:00:00.000Z' }],
      [
        {
          id: 'p1',
          title: 'Booking',
          body: 'Confirmed',
          type: 'booking',
          link: '/bookings',
          createdAt: '2026-01-02T10:00:00.000Z',
          readAt: null,
        },
      ],
      new Set()
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('p1');
    expect(merged[0].source).toBe('personal');
    expect(merged[0].type).toBe('booking');
    expect(merged[0].read).toBe(false);
    expect(merged[1].source).toBe('broadcast');
    expect(merged[1].type).toBe('announcement');
  });

  test('marks broadcast read from readIds and personal from readAt', () => {
    const merged = mergeInboxMessages(
      [{ id: 'b1', title: 'A', body: '', createdAt: '2026-01-01T10:00:00.000Z' }],
      [{ id: 'p1', title: 'B', body: '', createdAt: '2026-01-01T09:00:00.000Z', readAt: '2026-01-01T11:00:00.000Z' }],
      new Set(['b1'])
    );
    expect(merged.find((m) => m.id === 'b1')?.read).toBe(true);
    expect(merged.find((m) => m.id === 'p1')?.read).toBe(true);
  });
});

describe('countUnreadInboxMessages', () => {
  test('counts unread only', () => {
    expect(
      countUnreadInboxMessages([
        { read: true },
        { read: false },
        { read: false },
      ])
    ).toBe(2);
  });
});
