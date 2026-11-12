import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const operations = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  setGroupHidden: vi.fn(),
  setOccurrenceVisibility: vi.fn(),
  resetOccurrenceVisibility: vi.fn(),
}));
vi.mock('../../src/services/CalendarPreferencesService', () => ({ CalendarPreferencesService: operations }));
vi.mock('../../src/middleware/auth', () => ({
  requireAuth: (_req: unknown, res: { locals: { user?: { id: string } }; status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (!res.locals.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  },
}));

import calendarRoutes from '../../src/routes/calendarPreferences';
import {
  CalendarPlanNotFoundError,
  CalendarOfferingNotInPlanError,
  CalendarIdentityCollisionError,
} from '../../src/domain/calendar/preferences';

const planId = '11111111-1111-4111-8111-111111111111';
const group = { courseOfferingId: 'offering-1', studyGroupId: 'group-1' };
const occurrence = {
  ...group,
  occurrenceKeyVersion: 1,
  occurrenceKey: JSON.stringify(['series', 'offering-1', 'group-1', 'series-1', 1790000000000]),
};

let server: Server;
let root: string;
let isAuthenticated = true;

beforeEach(async () => {
  vi.clearAllMocks();
  isAuthenticated = true;
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    if (isAuthenticated) res.locals.user = { id: 'user-1' };
    next();
  });
  app.use('/api/plans/:planId/calendar', calendarRoutes);
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  root = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/plans/${planId}/calendar`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function put(path: string, body: unknown) {
  return fetch(`${root}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Calendar preferences API', () => {
  it('returns confirmed-empty preferences with HTTP 200', async () => {
    operations.getPreferences.mockResolvedValue({ hiddenGroups: [], occurrenceOverrides: [] });
    const response = await fetch(root);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
    expect(operations.getPreferences).toHaveBeenCalledWith('user-1', planId);
  });

  it('rejects unauthenticated access before calling the service', async () => {
    isAuthenticated = false;
    const response = await fetch(root);
    expect(response.status).toBe(401);
    expect(operations.getPreferences).not.toHaveBeenCalled();
  });

  it('writes and restores group state with a boolean flag', async () => {
    const response = await put('/groups', { ...group, hidden: false });
    expect(response.status).toBe(204);
    expect(operations.setGroupHidden).toHaveBeenCalledWith('user-1', planId, group, false);
  });

  it('rejects invalid group flags', async () => {
    const response = await put('/groups', { ...group, hidden: 'false' });
    expect(response.status).toBe(400);
    expect(operations.setGroupHidden).not.toHaveBeenCalled();
  });

  it('writes an explicit occurrence override', async () => {
    const response = await put('/occurrences', { ...occurrence, visibility: 'visible' });
    expect(response.status).toBe(204);
    expect(operations.setOccurrenceVisibility).toHaveBeenCalledWith('user-1', planId, { ...occurrence, visibility: 'visible' });
  });

  it('resets an occurrence override when visibility is null', async () => {
    const response = await put('/occurrences', { ...occurrence, visibility: null });
    expect(response.status).toBe(204);
    expect(operations.resetOccurrenceVisibility).toHaveBeenCalledWith('user-1', planId, occurrence);
  });

  it('does not treat an invalid visibility value as a reset', async () => {
    const response = await put('/occurrences', { ...occurrence, visibility: 'inherit' });
    expect(response.status).toBe(400);
    expect(operations.resetOccurrenceVisibility).not.toHaveBeenCalled();
  });

  it('maps plan, membership, and collision failures without leaking details', async () => {
    for (const [error, code] of [
      [new CalendarPlanNotFoundError(), 404],
      [new CalendarOfferingNotInPlanError(), 409],
      [new CalendarIdentityCollisionError(), 409],
    ] as const) {
      operations.setGroupHidden.mockRejectedValueOnce(error);
      expect((await put('/groups', { ...group, hidden: true })).status).toBe(code);
    }
  });

  it('does not convert persistence failure into empty preferences', async () => {
    operations.getPreferences.mockRejectedValue(new Error('db unavailable'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await fetch(root);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Calendar preference operation failed' });
    } finally {
      spy.mockRestore();
    }
  });
});
