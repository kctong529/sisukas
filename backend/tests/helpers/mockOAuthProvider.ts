import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';

export type OAuthIdentity = {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
};

type Authorization = { identity: OAuthIdentity; redirectUri: string; clientId: string };

/** Local test-only authorization-code provider. Never expose it on a public interface. */
export class MockOAuthProvider {
  readonly providerId = 'sisukas-fixture';
  readonly clientId = 'sisukas-integration-test';
  readonly clientSecret = 'local-integration-only';
  private server?: Server;
  private codes = new Map<string, Authorization>();
  private tokens = new Map<string, OAuthIdentity>();
  private identity?: OAuthIdentity;
  private cancelled = false;
  origin = '';

  async start(): Promise<void> {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    app.get('/authorize', (req, res) => {
      const redirectUri = String(req.query.redirect_uri ?? '');
      const state = String(req.query.state ?? '');
      const clientId = String(req.query.client_id ?? '');
      if (!this.identity || !state || clientId !== this.clientId) {
        res.status(400).send('Invalid authorization request');
        return;
      }
      const callback = new URL(redirectUri);
      callback.searchParams.set('state', state);
      if (this.cancelled) {
        callback.searchParams.set('error', 'access_denied');
      } else {
        const code = randomUUID();
        this.codes.set(code, { identity: { ...this.identity }, redirectUri, clientId });
        callback.searchParams.set('code', code);
      }
      // 302 is intentional: tests must exercise the actual Better Auth callback.
      res.redirect(302, callback.toString());
    });

    app.post('/token', (req, res) => {
      const code = String(req.body.code ?? '');
      const item = this.codes.get(code);
      this.codes.delete(code); // one-time authorization code
      if (
        !item || String(req.body.grant_type) !== 'authorization_code' ||
        String(req.body.client_id) !== item.clientId ||
        String(req.body.client_secret) !== this.clientSecret ||
        String(req.body.redirect_uri) !== item.redirectUri
      ) {
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }
      const accessToken = randomUUID();
      this.tokens.set(accessToken, item.identity);
      res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 1800 });
    });

    app.get('/userinfo', (req, res) => {
      const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
      const identity = this.tokens.get(token);
      if (!identity) {
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      res.json({
        sub: identity.id,
        id: identity.id,
        name: identity.name ?? 'OAuth fixture user',
        email: identity.email,
        email_verified: identity.emailVerified,
      });
    });

    this.server = await new Promise<Server>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    this.origin = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  setIdentity(identity: OAuthIdentity, opts: { cancelled?: boolean } = {}): void {
    this.identity = identity;
    this.cancelled = opts.cancelled ?? false;
  }

  async close(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) =>
      this.server!.close((error) => error ? reject(error) : resolve()),
    );
    this.server = undefined;
    this.codes.clear();
    this.tokens.clear();
  }
}
