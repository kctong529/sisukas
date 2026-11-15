import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { account, favourites, users } from '../../src/db/schema';
import { auth } from '../../src/lib/auth';
import { verifyCalendarTestDatabase } from './testDatabase';

// Explicit opt-in: inserts temporary users in Supabase TEST only.
const suite = process.env.ACCOUNT_LINKING_HTTP_TEST === 'yes' ? describe : describe.skip;

type TestUser = { id: string; cookie: string; email: string; accountId: string };

suite('Account linking: Better Auth HTTP safeguards (Supabase Test only)', () => {
  const runId = randomUUID();
  const createdIds: string[] = [];
  let server: Server | undefined;
  let baseUrl: string;
  let alice: TestUser;
  let bob: TestUser;
  let favouriteId: string;

  async function request(
    path: string,
    options: { method?: string; cookie?: string; body?: unknown } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      origin: new URL(process.env.BACKEND_URL!).origin,
    };
    if (options.cookie) headers.cookie = options.cookie;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    });
  }

  async function signup(label: string): Promise<TestUser> {
    const email = `account-link-${label}-${runId}@example.invalid`;
    const response = await request('/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        name: `Account link ${label}`,
        email,
        password: `LinkTest!${randomBytes(20).toString('hex')}`,
      },
    });
    const payload = await response.json() as { user?: { id?: string } };
    if (response.status !== 200 || !payload.user?.id) {
      throw new Error(`Fixture signup failed (${response.status})`);
    }
    // Register immediately so partial setup is cleaned up.
    createdIds.push(payload.user.id);
    const cookie = response.headers.getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .filter(Boolean)
      .join('; ');
    if (!cookie) throw new Error('Fixture signup returned no session cookie');

    const rows = await db.select({ id: account.id })
      .from(account).where(eq(account.userId, payload.user.id));
    if (rows.length !== 1) throw new Error('Expected one credential account for fixture');
    return { id: payload.user.id, email, cookie, accountId: rows[0].id };
  }

  async function assertOwnerUnchanged(): Promise<void> {
    const [identity] = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.id, alice.id));
    const [fav] = await db.select({ userId: favourites.userId })
      .from(favourites).where(eq(favourites.id, favouriteId));
    expect(identity).toEqual({ id: alice.id, email: alice.email });
    expect(fav?.userId).toBe(alice.id);
  }

  beforeAll(async () => {
    verifyCalendarTestDatabase();
    if (!process.env.BACKEND_URL || !process.env.BETTER_AUTH_SECRET) {
      throw new Error('Set BACKEND_URL and BETTER_AUTH_SECRET in backend/.env.test');
    }
    const app = express();
    app.all('/api/auth/{*any}', toNodeHandler(auth));
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    alice = await signup('alice');
    bob = await signup('bob');
    const inserted = await db.insert(favourites).values({
      userId: alice.id,
      courseId: `LINK-${runId.slice(0, 12)}`,
    }).returning({ id: favourites.id });
    favouriteId = inserted[0].id;
  });

  afterAll(async () => {
    try {
      // Delete only user IDs returned by this test's successful signup calls.
      for (const id of createdIds) await db.delete(users).where(eq(users.id, id));
    } finally {
      if (server) await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it('requires a session for account enumeration and explicit linking', async () => {
    const accounts = await request('/api/auth/list-accounts');
    expect(accounts.status).toBeGreaterThanOrEqual(400);
    const link = await request('/api/auth/link-social', {
      method: 'POST', body: { provider: 'google' },
    });
    expect(link.status).toBeGreaterThanOrEqual(400);
    await assertOwnerUnchanged();
  });

  it('lists only the current user’s credentials', async () => {
    const response = await request('/api/auth/list-accounts', { cookie: alice.cookie });
    expect(response.status).toBe(200);
    const accounts = await response.json() as Array<{ id: string; providerId: string }>;
    expect(accounts.map((item) => item.id)).toContain(alice.accountId);
    expect(accounts.map((item) => item.id)).not.toContain(bob.accountId);
  });

  it('does not permit unlinking another user’s provider account', async () => {
    const response = await request('/api/auth/unlink-account', {
      method: 'POST', cookie: alice.cookie, body: { accountId: bob.accountId },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select({ id: account.id, userId: account.userId })
      .from(account).where(eq(account.id, bob.accountId));
    expect(rows).toEqual([{ id: bob.accountId, userId: bob.id }]);
    await assertOwnerUnchanged();
  });

  it('refuses to unlink the only credential account', async () => {
    const response = await request('/api/auth/unlink-account', {
      method: 'POST', cookie: alice.cookie, body: { accountId: alice.accountId },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select({ id: account.id })
      .from(account).where(eq(account.id, alice.accountId));
    expect(rows).toHaveLength(1);
    await assertOwnerUnchanged();
  });

  it('rejects an invalid session without touching accounts or user data', async () => {
    const response = await request('/api/auth/unlink-account', {
      method: 'POST', cookie: 'better-auth.session_token=not-a-real-session',
      body: { accountId: alice.accountId },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select({ id: account.id })
      .from(account).where(eq(account.id, alice.accountId));
    expect(rows).toHaveLength(1);
    await assertOwnerUnchanged();
  });

  it('enforces database-level provider identity uniqueness', async () => {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'account'
          AND i.indisunique AND i.indpred IS NULL
          AND (SELECT array_agg(a.attname ORDER BY a.attname)
               FROM unnest(i.indkey) AS keynum(attnum)
               JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = keynum.attnum)
              = ARRAY['account_id', 'provider_id']::name[]
      ) AS has_provider_identity_unique_index
    `);
    expect(result.rows[0]?.has_provider_identity_unique_index).toBe(true);
  });

  it('rejects assigning one provider identity to two users', async () => {
    const providerId = 'test-uniqueness';
    const externalId = `external-${randomUUID()}`;

    let duplicateRejected = false;

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(account).values({
          id: randomUUID(),
          userId: alice.id,
          providerId,
          accountId: externalId,
          updatedAt: new Date(),
        });

        try {
          await tx.insert(account).values({
            id: randomUUID(),
            userId: bob.id,
            providerId,
            accountId: externalId,
            updatedAt: new Date(),
          });
        } catch (error) {
          duplicateRejected = true;
          throw error;
        }

        // Force rollback if the constraint is unexpectedly absent.
        throw new Error('Duplicate provider identity was accepted');
      }),
    ).rejects.toThrow();

    expect(duplicateRejected).toBe(true);

    await assertOwnerUnchanged();
  });
});
