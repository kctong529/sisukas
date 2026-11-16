/** Small same-host cookie jar and explicit redirect driver for OAuth integration tests. */
export class OAuthTestClient {
  private readonly cookies = new Map<string, string>();
  constructor(readonly baseUrl: string) {}

  async request(pathOrUrl: string, opts: { method?: string; body?: unknown } = {}): Promise<Response> {
    const url = new URL(pathOrUrl, this.baseUrl);
    const headers: Record<string, string> = { origin: this.baseUrl };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    // The mock provider doesn't need authentication cookies.
    if (url.origin === this.baseUrl && this.cookies.size) {
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      redirect: 'manual',
    });
    if (url.origin === this.baseUrl) {
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(';', 1)[0];
        const i = pair.indexOf('=');
        if (i < 1) continue;
        const name = pair.slice(0, i);
        const contents = pair.slice(i + 1);
        if (!contents || /max-age=0(?:;|$)/i.test(value)) this.cookies.delete(name);
        else this.cookies.set(name, contents);
      }
    }
    return response;
  }

  /** Starts an OAuth flow and follows authorize -> callback, not the app redirect. */
  async oauth(providerId: string, kind: 'sign-in' | 'link'): Promise<Response> {
    const start = await this.request(`/api/auth/${kind === 'link' ? 'link-social' : 'sign-in/social'}`, {
      method: 'POST',
      body: { provider: providerId, callbackURL: `${this.baseUrl}/finished` },
    });
    if (!start.ok) {
      throw new Error(`OAuth ${kind} start failed (HTTP ${start.status}): ${(await start.text()).slice(0, 200)}`);
    }
    const payload = await start.json() as { url?: string };
    if (!payload.url) throw new Error(`OAuth ${kind} did not return redirect URL`);
    const authorize = await this.request(payload.url);
    const callbackURL = authorize.headers.get('location');
    if (authorize.status !== 302 || !callbackURL) {
      throw new Error(`Mock authorization failed (${authorize.status})`);
    }
    return this.request(callbackURL);
  }

  /** Do not print cookies or secret values in failure messages. */
  clear(): void { this.cookies.clear(); }
}
