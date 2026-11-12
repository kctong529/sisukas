import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { plans, users } from '../../src/db/schema';
import { auth } from '../../src/lib/auth';
import { extractSession } from '../../src/middleware/auth';
import plansRoutes from '../../src/routes/plans';
import calendarPreferencesRoutes from '../../src/routes/calendarPreferences';
import { verifyCalendarTestDatabase } from './testDatabase';

// Opt-in: creates real Better Auth users, plans, offerings, and preferences.
const suite = process.env.CALENDAR_HTTP_TEST === 'yes' ? describe : describe.skip;

interface TestAccount {
  userId: string;
  cookie: string;
}

suite('Calendar preferences: authenticated HTTP integration (Supabase Test only)', () => {
  const runId = randomUUID();
  const offeringId = `calendar-http-${runId}`;
  const group = { courseOfferingId: offeringId, studyGroupId: 'http-test-group' };
  const occurrence = {
    ...group,
    occurrenceKeyVersion: 1,
    occurrenceKey: JSON.stringify(['series', offeringId, group.studyGroupId, 'http-series', 1790000000000]),
  };

  let server: Server | undefined;
  let baseUrl: string;
  let owner: TestAccount;
  let outsider: TestAccount;
  let planId: string;
  const fixtureUsers: string[] = [];


  async function request(
    path: string,
    options: { method?: string; account?: TestAccount; body?: unknown } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.account) headers.cookie = options.account.cookie;
    // Better Auth checks Origin on state-changing auth requests.
    headers.origin = new URL(process.env.BACKEND_URL!).origin;
    return fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    });
  }

  async function jsonOrThrow(response: Response, expectedStatus: number): Promise<any> {
    const body = await response.text();
    if (response.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, received ${response.status}: ${body.slice(0, 400)}`);
    }
    return body ? JSON.parse(body) : undefined;
  }

  async function register(role: 'owner' | 'outsider'): Promise<TestAccount> {
    const email = `calendar-http-${role}-${runId}@example.invalid`;
    const password = `CalTest!${randomBytes(20).toString('hex')}`;
    const response = await request('/api/auth/sign-up/email', {
      method: 'POST',
      body: { name: `Calendar HTTP ${role}`, email, password },
    });
    const payload = await jsonOrThrow(response, 200);
    const id: unknown = payload?.user?.id;
    if (typeof id !== 'string') throw new Error(`Signup response contained no user ID for ${role}`);
    // Register immediately so cleanup covers later setup failures.
    fixtureUsers.push(id);

    const sessionCookie = response.headers.getSetCookie()
      .map((header) => header.split(';', 1)[0])
      .filter((cookie) => cookie.includes('='))
      .join('; ');
    if (!sessionCookie) throw new Error(`Better Auth returned no session cookie for ${role}`);

    const account = { userId: id, cookie: sessionCookie };
    const session = await jsonOrThrow(
      await request('/api/auth/get-session', { account }), 200,
    );
    if (session?.user?.id !== id) throw new Error(`Session did not resolve to ${role} fixture user`);
    return account;
  }

  async function cleanup(): Promise<void> {
    // IDs are captured from successful Better Auth signup responses. Never delete
    // by email prefix, name, or broad SQL filters.
    for (const userId of fixtureUsers) {
      await db.delete(users).where(eq(users.id, userId));
    }
    fixtureUsers.length = 0;
  }

  beforeAll(async () => {
    verifyCalendarTestDatabase();
    if (!process.env.BACKEND_URL || !process.env.BETTER_AUTH_SECRET) {
      throw new Error('Configure BACKEND_URL and BETTER_AUTH_SECRET in backend/.env.test');
    }
    const tables = await db.execute(sql`
      SELECT to_regclass('public.calendar_hidden_groups')::text AS hidden,
             to_regclass('public.calendar_occurrence_overrides')::text AS overrides
    `);
    if (!tables.rows[0]?.hidden || !tables.rows[0]?.overrides) {
      throw new Error('Calendar migration 0005 is not installed on Supabase Test');
    }

    const app = express();
    app.all('/api/auth/{*any}', toNodeHandler(auth));
    app.use(express.json());
    app.use(extractSession);
    app.use('/api/plans/:planId/calendar', calendarPreferencesRoutes);
    app.use('/api/plans', plansRoutes);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      owner = await register('owner');
      outsider = await register('outsider');
      const plan = await jsonOrThrow(await request('/api/plans', {
        method: 'POST', account: owner, body: { name: `Calendar HTTP ${runId}` },
      }), 201);
      if (typeof plan?.id !== 'string') throw new Error('Plan creation response had no ID');
      planId = plan.id;
      await jsonOrThrow(await request(`/api/plans/${planId}/instances`, {
        method: 'POST', account: owner, body: { instanceId: offeringId },
      }), 200);
    } catch (error) {
      // afterAll also attempts cleanup; retain the original setup error.
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
        });
      }
    }
  });

  it('resolves genuine Better Auth sessions and rejects unauthenticated/foreign plans', async () => {
    const path = `/api/plans/${planId}/calendar`;
    expect((await request(path)).status).toBe(401);
    expect((await request(path, { account: outsider })).status).toBe(404);
    expect(await jsonOrThrow(await request(path, { account: owner }), 200))
      .toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
    expect((await request(`${path}/groups`, {
      method: 'PUT', account: outsider, body: { ...group, hidden: true },
    })).status).toBe(404);
  });

  it('persists group and occurrence preferences across authenticated requests', async () => {
    const path = `/api/plans/${planId}/calendar`;
    await jsonOrThrow(await request(`${path}/groups`, {
      method: 'PUT', account: owner, body: { ...group, hidden: true },
    }), 204);
    await jsonOrThrow(await request(`${path}/occurrences`, {
      method: 'PUT', account: owner, body: { ...occurrence, visibility: 'visible' },
    }), 204);

    const state = await jsonOrThrow(await request(path, { account: owner }), 200);
    expect(state.hiddenGroups).toEqual([group]);
    expect(state.occurrenceOverrides).toEqual([{ ...occurrence, visibility: 'visible' }]);
    expect((await request(path, { account: outsider })).status).toBe(404);
  });

  it('retains dormant preferences after offering removal and resets them through HTTP', async () => {
    const path = `/api/plans/${planId}/calendar`;
    await jsonOrThrow(await request(`/api/plans/${planId}/instances/${encodeURIComponent(offeringId)}`, {
      method: 'DELETE', account: owner,
    }), 200);

    const dormant = await jsonOrThrow(await request(path, { account: owner }), 200);
    expect(dormant.hiddenGroups).toEqual([group]);
    expect(dormant.occurrenceOverrides).toEqual([{ ...occurrence, visibility: 'visible' }]);
    expect((await request(`${path}/groups`, {
      method: 'PUT', account: owner, body: { ...group, hidden: true },
    })).status).toBe(409);

    await jsonOrThrow(await request(`${path}/occurrences`, {
      method: 'PUT', account: owner, body: { ...occurrence, visibility: null },
    }), 204);
    await jsonOrThrow(await request(`${path}/groups`, {
      method: 'PUT', account: owner, body: { ...group, hidden: false },
    }), 204);
    expect(await jsonOrThrow(await request(path, { account: owner }), 200))
      .toEqual({ hiddenGroups: [], occurrenceOverrides: [] });
  });

  it('cleans up the fixture plan on deletion (preferences already reset)', async () => {
    expect((await request(`/api/plans/${planId}`, {
      method: 'DELETE', account: owner,
    })).status).toBe(204);
    expect((await request(`/api/plans/${planId}/calendar`, { account: owner })).status).toBe(404);
    expect(await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId))).toEqual([]);
  });
});
