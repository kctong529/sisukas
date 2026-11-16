import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNodeHandler } from 'better-auth/node';
import { genericOAuth } from 'better-auth/plugins';
import { and, eq, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { account, favourites, session, users } from '../../src/db/schema';
import * as schema from '../../src/db/schema';
import { accountLinkingPolicy } from '../../src/lib/accountLinkingPolicy';
import { MockOAuthProvider, type OAuthIdentity } from '../helpers/mockOAuthProvider';
import { OAuthTestClient } from '../helpers/oauthTestClient';
import { verifyCalendarTestDatabase } from './testDatabase';

const suite = process.env.ACCOUNT_LINKING_OAUTH_TEST === 'yes' ? describe : describe.skip;

type Fixture = { id: string; email: string; client: OAuthTestClient };

suite('Account linking: real OAuth callbacks (Supabase Test only)', () => {
  const runId = randomUUID();
  const fixtures: Fixture[] = [];
  const mock = new MockOAuthProvider();
  let server: Server | undefined;
  let origin = '';
  let handler: ReturnType<typeof toNodeHandler> | undefined;

  const identity = (name: string, email: string, verified = true): OAuthIdentity => ({
    id: `ext-${runId}-${name}`,
    email,
    emailVerified: verified,
    name: `OAuth ${name}`,
  });

  async function newUser(label: string, magicLinkOnly = false): Promise<Fixture> {
    const client = new OAuthTestClient(origin);
    const email = `oauth-${label}-${runId}@example.invalid`;
    const response = await client.request('/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        name: `Linking fixture ${label}`,
        email,
        password: `Integration!${randomBytes(20).toString('hex')}`,
      },
    });
    const body = await response.json() as { user?: { id?: string } };
    if (!response.ok || !body.user?.id) throw new Error(`Signup fixture failed: ${response.status}`);
    const user: Fixture = { id: body.user.id, email, client };
    fixtures.push(user); // ensure teardown even if later setup fails
    if (magicLinkOnly) {
      // Magic-link sign-in creates users with no credential account row.
      // Retain Better Auth's genuine session, remove only our generated password credential.
      await db.delete(account).where(eq(account.userId, user.id));
    }
    return user;
  }

  async function providerAccounts(externalId: string) {
    return db.select({ userId: account.userId, accountId: account.accountId })
      .from(account).where(and(eq(account.providerId, mock.providerId), eq(account.accountId, externalId)));
  }

  async function assertOwner(user: Fixture, favouriteId: string): Promise<void> {
    const [owner] = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.id, user.id));
    const [favourite] = await db.select({ userId: favourites.userId })
      .from(favourites).where(eq(favourites.id, favouriteId));
    expect(owner).toEqual({ id: user.id, email: user.email });
    expect(favourite?.userId).toBe(user.id);
  }

  beforeAll(async () => {
    verifyCalendarTestDatabase();
    if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET required in .env.test');
    await mock.start();
    // Bind an ephemeral localhost port *before* constructing Better Auth so the
    // configured base URL and OAuth callback URL exactly match actual requests.
    const app = express();
    app.all('/api/auth/{*any}', (req, res) => {
      if (!handler) { res.status(503).end(); return; }
      handler(req, res);
    });
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const auth = betterAuth({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: `${origin}/api/auth`,
      trustedOrigins: [origin],
      database: drizzleAdapter(db, { provider: 'pg', schema: { ...schema, user: schema.users } }),
      account: { accountLinking: accountLinkingPolicy },
      emailAndPassword: { enabled: true },
      plugins: [genericOAuth({ config: [{
        providerId: mock.providerId,
        clientId: mock.clientId,
        clientSecret: mock.clientSecret,
        authorizationUrl: `${mock.origin}/authorize`,
        tokenUrl: `${mock.origin}/token`,
        pkce: false, // mock server implements only the code exchange; not a production setting
        getUserInfo: async (tokens) => {
          const response = await fetch(`${mock.origin}/userinfo`, {
            headers: { authorization: `Bearer ${tokens.accessToken}` },
          });
          if (!response.ok) return null;
          const data = await response.json() as {
            sub: string; email: string; name: string; email_verified: boolean;
          };
          return {
            id: data.sub,
            email: data.email,
            name: data.name,
            emailVerified: data.email_verified,
          };
        },
      }] })],
    });
    handler = toNodeHandler(auth);
  });

  afterAll(async () => {
    try {
      // Also remove OAuth-only fixture users created by successful new-user sign-in.
      const all = await db.select({ id: users.id, email: users.email }).from(users)
        .where(like(users.email, `oauth-%-${runId}@example.invalid`));
      const ids = new Set(fixtures.map((f) => f.id));
      for (const user of all) {
        if (user.email.startsWith('oauth-') && user.email.endsWith(`-${runId}@example.invalid`)) {
          ids.add(user.id);
        }
      }
      for (const id of ids) await db.delete(users).where(eq(users.id, id));
    } finally {
      await Promise.allSettled([
        mock.close(),
        new Promise<void>((resolve, reject) => {
          if (!server) { resolve(); return; }
          server.close((error) => error ? reject(error) : resolve());
        }),
      ]);
    }
  });

  it('does not implicitly merge an unlinked provider with a magic-link user of the same email', async () => {
    const original = await newUser('implicit', true);
    const social = identity('implicit', original.email);
    mock.setIdentity(social);
    await new OAuthTestClient(origin).oauth(mock.providerId, 'sign-in');
    expect(await providerAccounts(social.id)).toHaveLength(0);
    expect((await db.select({ id: users.id }).from(users).where(eq(users.email, original.email))))
      .toEqual([{ id: original.id }]);
  });

  it('links explicitly to an existing magic-link user without changing ownership', async () => {
    const original = await newUser('explicit', true);
    const [{ id: favouriteId }] = await db.insert(favourites).values({
      userId: original.id, courseId: `OAUTH-${runId.slice(0, 10)}`,
    }).returning({ id: favourites.id });
    const social = identity('explicit', original.email);
    mock.setIdentity(social);
    const response = await original.client.oauth(mock.providerId, 'link');
    expect(response.status).toBeLessThan(400);
    expect(await providerAccounts(social.id)).toEqual([{
      userId: original.id, accountId: social.id,
    }]);
    await assertOwner(original, favouriteId);
  });

  it('refuses to reassign a provider identity already linked to another user', async () => {
    const alice = await newUser('conflict-a', true);
    const bob = await newUser('conflict-b', true);
    const social = identity('conflict', alice.email);
    mock.setIdentity(social);
    await alice.client.oauth(mock.providerId, 'link');
    expect(await providerAccounts(social.id)).toEqual([{ userId: alice.id, accountId: social.id }]);
    mock.setIdentity({ ...social, email: bob.email });
    await bob.client.oauth(mock.providerId, 'link');
    expect(await providerAccounts(social.id)).toEqual([{ userId: alice.id, accountId: social.id }]);
  });

  it('rejects explicit linking when provider email differs', async () => {
    const user = await newUser('mismatch', true);
    const social = identity('mismatch', `another-${runId}@example.invalid`);
    mock.setIdentity(social);
    await user.client.oauth(mock.providerId, 'link');
    expect(await providerAccounts(social.id)).toHaveLength(0);
  });

  it('rejects linking an unverified provider email', async () => {
    const user = await newUser('unverified', true);
    const social = identity('unverified', user.email, false);
    mock.setIdentity(social);
    await user.client.oauth(mock.providerId, 'link');
    expect(await providerAccounts(social.id)).toHaveLength(0);
  });

  it('does not link after provider cancellation', async () => {
    const user = await newUser('cancelled', true);
    const social = identity('cancelled', user.email);
    mock.setIdentity(social, { cancelled: true });
    await user.client.oauth(mock.providerId, 'link');
    expect(await providerAccounts(social.id)).toHaveLength(0);
  });

  it('requires authenticated linking and rejects invalid callback state', async () => {
    const user = await newUser('state', true);
    const social = identity('state', user.email);
    mock.setIdentity(social);
    const guest = new OAuthTestClient(origin);
    const denied = await guest.request('/api/auth/link-social', {
      method: 'POST', body: { provider: mock.providerId },
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    const invalidState = await user.client.request('/api/auth/callback/sisukas-fixture?state=invalid&code=invalid');
    expect(invalidState.status).not.toBe(200);
    expect(await providerAccounts(social.id)).toHaveLength(0);
  });

  it('signs up a new user for a genuinely new verified OAuth identity', async () => {
    const social = identity('new', `oauth-new-${runId}@example.invalid`);
    mock.setIdentity(social);
    await new OAuthTestClient(origin).oauth(mock.providerId, 'sign-in');
    const linked = await providerAccounts(social.id);
    expect(linked).toHaveLength(1);
    const [created] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, social.email));
    expect(linked[0].userId).toBe(created?.id);
  });

  it('does not link when the authenticated session has expired', async () => {
    const user = await newUser('expired', true);
    const social = identity('expired', user.email);
    mock.setIdentity(social);
    await db.delete(session).where(eq(session.userId, user.id));
    const response = await user.client.request('/api/auth/link-social', {
      method: 'POST', body: { provider: mock.providerId },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await providerAccounts(social.id)).toHaveLength(0);
  });
});
