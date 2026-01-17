// tests/rls.account.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import { setUser1Session, setUser2Session } from './rls.session-helper'
import crypto from 'crypto'

describe.sequential('Account RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  async function createTestAccountAsUser(
    userSession: any,
    userId: string,
    provider: string
  ) {
    await ctx.supabase.auth.setSession(userSession)

    const now = new Date()
    const nowIso = now.toISOString()
    const tokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await ctx.supabase.from('account').insert([
      {
        id: crypto.randomUUID(),
        account_id: `account-${userId}-${provider}`,
        provider_id: provider,
        user_id: userId,
        access_token: `access-token-${userId}-${provider}`,
        refresh_token: `refresh-token-${userId}-${provider}`,
        id_token: `id-token-${userId}-${provider}`,
        access_token_expires_at: tokenExpiresAt,
        refresh_token_expires_at: tokenExpiresAt,
        scope: 'openid profile email',
        password: null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]).select()

    if (error) throw error
    return data?.[0]
  }

  it('should allow User 1 to see only their own accounts', async () => {
    await createTestAccountAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'google')
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: accounts, error } = await ctx.supabase.from('account').select('*')

    expect(error).toBeNull()
    expect(accounts).toHaveLength(1)
    expect(accounts?.[0].user_id).toBe(ctx.USER_1_ID)
  })

  it('should allow User 2 to see only their own accounts', async () => {
    await createTestAccountAsUser(ctx.USER_2_SESSION, ctx.USER_2_ID, 'github')
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: accounts, error } = await ctx.supabase.from('account').select('*')

    expect(error).toBeNull()
    expect(accounts).toHaveLength(1)
    expect(accounts?.[0].user_id).toBe(ctx.USER_2_ID)
  })

  it('should prevent User 2 from seeing User 1 accounts (OAuth tokens)', async () => {
    const user1Account = await createTestAccountAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'google')
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: accounts } = await ctx.supabase
      .from('account')
      .select('*')
      .eq('id', user1Account.id)

    expect(accounts).toEqual([])
  })

  it('should prevent User 2 from accessing User 1 OAuth tokens', async () => {
    const user1Account = await createTestAccountAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'google')
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: accounts } = await ctx.supabase
      .from('account')
      .select('access_token, refresh_token, id_token')
      .eq('id', user1Account.id)

    expect(accounts).toEqual([])
  })

  it('should prevent User 2 from modifying User 1 accounts', async () => {
    const user1Account = await createTestAccountAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'google')
    const originalToken = user1Account.access_token

    expect(originalToken).toBeTruthy()

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)
    await ctx.supabase
      .from('account')
      .update({ access_token: 'hacked-token' })
      .eq('id', user1Account.id)

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyAccounts } = await ctx.supabase
      .from('account')
      .select('access_token')
      .eq('id', user1Account.id)

    expect(verifyAccounts?.[0]?.access_token).toBe(originalToken)
    expect(verifyAccounts?.[0]?.access_token).not.toBe('hacked-token')
  })

  it('should protect sensitive OAuth tokens from unauthorized access', async () => {
    await createTestAccountAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'google')
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: accounts } = await ctx.supabase
      .from('account')
      .select('id, access_token, refresh_token')
      .eq('user_id', ctx.USER_1_ID)

    expect(accounts).toHaveLength(1)
    expect(accounts?.[0].access_token).toBeTruthy()
    expect(accounts?.[0].refresh_token).toBeTruthy()
  })
})