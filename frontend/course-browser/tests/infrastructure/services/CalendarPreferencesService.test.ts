import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CalendarPreferenceHttpError,
  CalendarPreferencesService,
} from '@infrastructure/services/CalendarPreferencesService';

const key = JSON.stringify(['series', 'offering-1', 'group-1', 'series-1', 1790000000000]);

afterEach(() => vi.unstubAllGlobals());

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('CalendarPreferencesService', () => {
  it('loads validated preferences using authenticated GET', async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({
      hiddenGroups: [], occurrenceOverrides: [],
    }), { status: 200 }));
    await expect(CalendarPreferencesService.load('plan-1')).resolves.toEqual({
      hiddenGroups: [], occurrenceOverrides: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/plans/plan-1/calendar'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('does not convert HTTP errors to confirmed-empty preferences', async () => {
    mockFetch(new Response(null, { status: 403 }));
    await expect(CalendarPreferencesService.load('plan-1')).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<CalendarPreferenceHttpError>);
  });

  it('rejects malformed successful JSON instead of default visibility', async () => {
    mockFetch(new Response(JSON.stringify({ hiddenGroups: [] }), { status: 200 }));
    await expect(CalendarPreferencesService.load('plan-1')).rejects.toThrow();
  });

  it('sends group hide and restore as credentialed PUTs and accepts 204', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    const group = { courseOfferingId: 'offering-1', studyGroupId: 'group-1' };
    await CalendarPreferencesService.setGroupHidden('plan-1', group, true);
    await CalendarPreferencesService.setGroupHidden('plan-1', group, false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT', credentials: 'include', body: JSON.stringify({ ...group, hidden: true }),
    });
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ ...group, hidden: false }));
  });

  it('writes explicit occurrence state and resets using null', async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));
    const occurrence = {
      courseOfferingId: 'offering-1', studyGroupId: 'group-1',
      occurrenceKeyVersion: 1 as const, occurrenceKey: key,
    };
    await CalendarPreferencesService.setOccurrenceVisibility('plan-1', occurrence, 'hidden');
    await CalendarPreferencesService.setOccurrenceVisibility('plan-1', occurrence, null);
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ ...occurrence, visibility: 'hidden' }));
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ ...occurrence, visibility: null }));
  });

  it('propagates failed PUT without acknowledging save', async () => {
    mockFetch(new Response(null, { status: 409 }));
    await expect(CalendarPreferencesService.setGroupHidden('plan-1', {
      courseOfferingId: 'offering-1', studyGroupId: 'group-1',
    }, true)).rejects.toBeInstanceOf(CalendarPreferenceHttpError);
  });
});
