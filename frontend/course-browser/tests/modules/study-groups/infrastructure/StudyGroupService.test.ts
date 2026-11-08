import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
function singleBody(events: SourceEvent[]) {
  return { course_unit_id: UNIT, course_offering_id: OFFERING, study_groups: [group(events)] };
}
function batchBody(events: SourceEvent[]) {
  return { total_requests: 1, results: { [KEY]: [group(events)] } };
}
function offeringsBody(events: SourceEvent[]) {
  return {
    total_requests: 1,
    results: { [KEY]: {
      course_unit_id: UNIT, offering_id: OFFERING, name: 'Example',
      assessment_items: ['assessment-1'], study_groups: [group(events)],
    } },
  };
}
function mockResponses(...bodies: unknown[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => response(bodies.shift())
  );
}
const service = () => new StudyGroupService(API);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('StudyGroupService: source-preserving normalization', () => {
  it('returns an empty array when a single response has no groups', async () => {
    mockResponses({ course_unit_id: UNIT, course_offering_id: OFFERING, study_groups: [] });
    expect(await service().fetchStudyGroups(UNIT, OFFERING)).toEqual([]);
  });

  it('preserves a group with zero events', async () => {
    mockResponses(singleBody([]));
    const result = await service().fetchStudyGroups(UNIT, OFFERING);
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
    mockResponses(singleBody([source]));
    const [normalized] = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents;
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
    mockResponses(singleBody([event(fields)]));
    const [e] = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents;
    expect(e).toMatchObject({ seriesId: null, cancelled: false, excluded: false,
      notice: null, locationIds: [], locations: [] });
    expect(e.startIso).toBeUndefined();
    expect(e.endIso).toBeUndefined();
    expect(e.location).toBeUndefined();
  });

  it('retains distinct source events with identical start and end', async () => {
    mockResponses(singleBody([
      event({ series_id: 'A', location_ids: ['room-A'] }),
      event({ series_id: 'B', location_ids: ['room-B'], cancelled: true }),
    ]));
    const events = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.seriesId)).toEqual(['A', 'B']);
    expect(events.map(e => e.id)).toEqual(['aalto-group-1:0', 'aalto-group-1:1']);
    expect(events[1].cancelled).toBe(true);
  });

  it('preserves multiple occurrences belonging to the same series', async () => {
    mockResponses(singleBody([
      event({ series_id: 'series-1' }),
      event({ series_id: 'series-1', start: '2026-11-09T10:15:00', end: '2026-11-09T12:00:00' }),
    ]));
    const events = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.seriesId)).toEqual(['series-1', 'series-1']);
  });

  it('preserves exact time strings even at boundaries; does not validate time intervals', async () => {
    mockResponses(singleBody([
      event({ start: end, end }),
      event({ start: '2026-11-02T23:30:00', end: '2026-11-03T00:30:00' }),
    ]));
    const events = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents;
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
    mockResponses(singleBody([event(fields)]));
    const e = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents[0];
    expect(e.location).toBe(expected);
  });

  it('does not mutate source records or share nested location arrays', async () => {
    const original = singleBody([event({
      location_ids: ['room-1'], locations: [{ id: 'room-1', name: 'Room A' }],
    })]);
    const before = structuredClone(original);
    mockResponses(original);
    const normalized = (await service().fetchStudyGroups(UNIT, OFFERING))[0].studyEvents[0];
    expect(original).toEqual(before);
    normalized.locationIds.push('new-room');
    normalized.locations[0].name = 'changed';
    expect(original).toEqual(before);
  });

  it('uses the same normalization for single, batch, and batch offerings', async () => {
    const source = [event({ series_id: 'A', location_ids: ['room-A'] }), event({ series_id: 'B' })];
    const fetchMock = mockResponses(singleBody(source), batchBody(source), offeringsBody(source));
    const api = service();
    const single = await api.fetchStudyGroups(UNIT, OFFERING);
    const batched = await api.fetchStudyGroupsBatch([{ courseUnitId: UNIT, courseOfferingId: OFFERING }]);
    const offerings = await api.fetchOfferingsBatch([{ courseUnitId: UNIT, offeringId: OFFERING }]);
    expect(batched.get(KEY)).toEqual(single);
    expect(offerings.get(KEY)?.studyGroups).toEqual(single);
    expect(offerings.get(KEY)?.assessmentItems).toEqual(['assessment-1']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/api/courses/study-groups?');
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/api/courses/batch/study-groups');
    expect(fetchMock.mock.calls[2][0].toString()).toContain('/api/courses/batch/offerings');
  });
});

describe('StudyGroupService: requests and error boundaries', () => {
  it('makes no network request for empty batches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await service().fetchStudyGroupsBatch([])).toEqual(new Map());
    expect(await service().fetchOfferingsBatch([])).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates repeated batch inputs before posting', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(batchBody([])));
    await service().fetchStudyGroupsBatch([
      { courseUnitId: UNIT, courseOfferingId: OFFERING },
      { courseUnitId: UNIT, courseOfferingId: OFFERING },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.requests).toHaveLength(1);
  });

  it.each([0, 1, 50, 51, 101])('clamps chunkSize=%i to 1..50', async (chunkSize) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ results: {}, total_requests: 0 }));
    const requests = Array.from({ length: 51 }, (_, n) => ({
      courseUnitId: `cu-${n}`, courseOfferingId: `co-${n}`,
    }));
    await service().fetchStudyGroupsBatch(requests, { chunkSize, concurrency: 1 });
    const expectedSize = Math.min(Math.max(chunkSize, 1), 50);
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(51 / expectedSize));
    for (const [, init] of fetchMock.mock.calls) {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.requests.length).toBeGreaterThanOrEqual(1);
      expect(body.requests.length).toBeLessThanOrEqual(50);
    }
  });

  it('reports progress and chunk results for every completed chunk', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ results: {}, total_requests: 0 }));
    const onProgress = vi.fn();
    const onChunk = vi.fn();
    await service().fetchStudyGroupsBatch(
      Array.from({ length: 3 }, (_, i) => ({ courseUnitId: `cu-${i}`, courseOfferingId: 'co' })),
      { chunkSize: 1, concurrency: 1, onProgress, onChunk }
    );
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls.map(([p]) => p)).toEqual([
      { done: 1, total: 3 }, { done: 2, total: 3 }, { done: 3, total: 3 },
    ]);
  });

  it.each([99, 100])('accepts %i offering requests', async (count) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ results: {}, total_requests: count }));
    const result = await service().fetchOfferingsBatch(
      Array.from({ length: count }, (_, i) => ({ courseUnitId: `cu-${i}`, offeringId: 'co' }))
    );
    expect(result.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects 101 offering requests locally without calling fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const result = await service().fetchOfferingsBatch(
      Array.from({ length: 101 }, (_, i) => ({ courseUnitId: `cu-${i}`, offeringId: 'co' }))
    );
    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it.each([404, 422, 500, 502, 504, 418])('handles HTTP %i without throwing', async status => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({}, status));
    const result = await service().fetchStudyGroups(UNIT, OFFERING);
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('handles rejected network requests without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await service().fetchStudyGroups(UNIT, OFFERING)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('handles malformed response shape without throwing', async () => {
    mockResponses({ unexpected: true });
    expect(await service().fetchStudyGroups(UNIT, OFFERING)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
