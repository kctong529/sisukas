import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudyGroupService } from '@modules/study-groups/infrastructure/StudyGroupService';

type SourceEvent = {
  start: string;
  end: string;
  start_iso?: string | null;
  end_iso?: string | null;
  series_id?: string | null;
  cancelled?: boolean;
  excluded?: boolean;
  notice?: string | null;
  location?: string;
  location_ids?: string[];
  locations?: Array<{
    id: string;
    name: string;
    building_id?: string | null;
    building_name?: string | null;
    address?: string | null;
  }>;
};

const API = 'https://wrapper.example.test';
const UNIT = 'aalto-CU-1';
const OFFERING = 'aalto-CO-1';
const KEY = `${UNIT}:${OFFERING}`;
const request = { courseUnitId: UNIT, courseOfferingId: OFFERING };
const start = '2026-11-02T10:15:00';
const end = '2026-11-02T12:00:00';

function event(overrides: Partial<SourceEvent> = {}): SourceEvent {
  return { start, end, ...overrides };
}

function group(events: SourceEvent[] = []) {
  return {
    group_id: 'aalto-group-1', name: 'L01', type: 'Lecture', study_events: events,
  };
}

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function batchBody(events: SourceEvent[]) {
  return { total_requests: 1, results: { [KEY]: [group(events)] } };
}

function mockResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(body, status));
}

const service = () => new StudyGroupService(API);

async function groupsFrom(body: unknown) {
  mockResponse(body);
  const result = await service().fetchStudyGroupsChunk([request]);
  return result.get(KEY);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StudyGroupService: source-preserving normalization', () => {
  it('returns a successfully empty array when the batch result has no groups', async () => {
    expect(await groupsFrom({ total_requests: 1, results: { [KEY]: [] } })).toEqual([]);
  });

  it('preserves a group with zero events', async () => {
    const result = await groupsFrom(batchBody([]));
    expect(result).toEqual([{ groupId: 'aalto-group-1', name: 'L01', type: 'Lecture', studyEvents: [] }]);
  });

  it('preserves all metadata, resolved rooms, and offset-aware timestamps', async () => {
    const source = event({
      start_iso: '2026-11-02T10:15:00+02:00',
      end_iso: '2026-11-02T12:00:00+02:00',
      series_id: 'series-A', cancelled: true, excluded: true, notice: 'Moved',
      location_ids: ['room-1'], locations: [{
        id: 'room-1', name: 'Hall 1', building_id: 'building-1',
        building_name: 'Main building', address: 'Example road 1',
      }],
    });
    const [normalized] = (await groupsFrom(batchBody([source])))![0].studyEvents;
    expect(normalized).toEqual({
      id: 'aalto-group-1:0', start, end,
      startIso: '2026-11-02T10:15:00+02:00',
      endIso: '2026-11-02T12:00:00+02:00',
      seriesId: 'series-A', cancelled: true, excluded: true, notice: 'Moved',
      locationIds: ['room-1'], locations: [{
        id: 'room-1', name: 'Hall 1', buildingId: 'building-1',
        buildingName: 'Main building', address: 'Example road 1',
      }], location: 'Hall 1',
    });
  });

  it.each([
    ['both absent', {}],
    ['null optional values', { series_id: null, notice: null, start_iso: null, end_iso: null }],
    ['empty locations', { location_ids: [], locations: [] }],
  ])('defaults omitted optional fields (%s)', async (_label, fields) => {
    const [e] = (await groupsFrom(batchBody([event(fields)])))![0].studyEvents;
    expect(e).toMatchObject({ seriesId: null, cancelled: false, excluded: false,
      notice: null, locationIds: [], locations: [] });
    expect(e.startIso).toBeUndefined();
    expect(e.endIso).toBeUndefined();
    expect(e.location).toBeUndefined();
  });

  it('retains distinct source events with identical start and end', async () => {
    const events = (await groupsFrom(batchBody([
      event({ series_id: 'A', location_ids: ['room-A'] }),
      event({ series_id: 'B', location_ids: ['room-B'], cancelled: true }),
    ])))![0].studyEvents;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.seriesId)).toEqual(['A', 'B']);
    expect(events.map(e => e.id)).toEqual(['aalto-group-1:0', 'aalto-group-1:1']);
    expect(events[1].cancelled).toBe(true);
  });

  it('preserves multiple occurrences belonging to the same series', async () => {
    const events = (await groupsFrom(batchBody([
      event({ series_id: 'series-1' }),
      event({ series_id: 'series-1', start: '2026-11-09T10:15:00', end: '2026-11-09T12:00:00' }),
    ])))![0].studyEvents;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.seriesId)).toEqual(['series-1', 'series-1']);
  });

  it('preserves exact time strings even at boundaries; does not validate time intervals', async () => {
    const events = (await groupsFrom(batchBody([
      event({ start: end, end }),
      event({ start: '2026-11-02T23:30:00', end: '2026-11-03T00:30:00' }),
    ])))![0].studyEvents;
    expect(events).toHaveLength(2);
    expect(events[0].start).toBe(events[0].end);
    expect(events[1].end).toBe('2026-11-03T00:30:00');
  });

  it.each([
    ['legacy display location', { location: '  Legacy hall  ' }, 'Legacy hall'],
    ['blank legacy location falls back to resolved rooms', {
      location: '   ', locations: [{ id: '1', name: 'Room A' }, { id: '2', name: 'Room B' }],
    }, 'Room A, Room B'],
    ['legacy display location takes precedence', {
      location: 'Canonical label', locations: [{ id: '1', name: 'Room A' }],
    }, 'Canonical label'],
  ])('%s', async (_label, fields, expected) => {
    const e = (await groupsFrom(batchBody([event(fields)])))![0].studyEvents[0];
    expect(e.location).toBe(expected);
  });

  it('does not mutate source records or share nested location arrays', async () => {
    const original = batchBody([event({
      location_ids: ['room-1'], locations: [{ id: 'room-1', name: 'Room A' }],
    })]);
    const before = structuredClone(original);
    const normalized = (await groupsFrom(original))![0].studyEvents[0];
    expect(original).toEqual(before);
    normalized.locationIds.push('new-room');
    normalized.locations[0].name = 'changed';
    expect(original).toEqual(before);
  });
});

describe('StudyGroupService: strict chunk transport', () => {
  it('makes no network request for an empty chunk', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await service().fetchStudyGroupsChunk([])).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes exactly one POST with requested offerings and resolved locations', async () => {
    const fetchMock = mockResponse(batchBody([]));
    const result = await service().fetchStudyGroupsChunk([request]);
    expect(result.get(KEY)).toEqual([{ groupId: 'aalto-group-1', name: 'L01', type: 'Lecture', studyEvents: [] }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${API}/api/courses/batch/study-groups?resolve_locations=true`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({ requests: [{
      course_unit_id: UNIT, course_offering_id: OFFERING,
    }] });
  });

  it('does not deduplicate or split requests inside the transport', async () => {
    const fetchMock = mockResponse({ results: {}, total_requests: 2 });
    await service().fetchStudyGroupsChunk([request, request]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).requests).toHaveLength(2);
  });

  it('allows 50 requests in one HTTP call', async () => {
    const fetchMock = mockResponse({ results: {}, total_requests: 50 });
    const requests = Array.from({ length: 50 }, (_, i) => ({
      courseUnitId: `cu-${i}`, courseOfferingId: `co-${i}`,
    }));
    await service().fetchStudyGroupsChunk(requests);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects 51 requests before making an HTTP call', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const requests = Array.from({ length: 51 }, (_, i) => ({
      courseUnitId: `cu-${i}`, courseOfferingId: `co-${i}`,
    }));
    await expect(service().fetchStudyGroupsChunk(requests)).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([404, 422, 500, 502, 504, 418])('rejects HTTP %i instead of fabricating empty data', async status => {
    mockResponse({}, status);
    await expect(service().fetchStudyGroupsChunk([request])).rejects.toThrow(`HTTP ${status}`);
  });

  it('propagates network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(service().fetchStudyGroupsChunk([request])).rejects.toThrow('offline');
  });

  it.each([
    null,
    {},
    { results: null },
    { results: [] },
    { results: { [KEY]: null } },
    { results: { [KEY]: {} } },
  ])('rejects malformed response shape (%j)', async body => {
    mockResponse(body);
    await expect(service().fetchStudyGroupsChunk([request])).rejects.toThrow(/Invalid study-group batch/);
  });

  it('propagates invalid JSON failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('invalid JSON', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service().fetchStudyGroupsChunk([request]),
    ).rejects.toThrow(SyntaxError);
  });
});
