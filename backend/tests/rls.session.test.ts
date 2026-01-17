// tests/rls.session.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import crypto from 'crypto'
import { setUser1Session, setUser2Session } from './rls.session-helper'

describe.sequential('Session RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  async function createTestSessionAsUser(userSession: any, userId: string, ipAddress: string) {
    // Set the user's session before inserting
    await ctx.supabase.auth.setSession(userSession)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const nowIso = now.toISOString()

    // Insert as the authenticated user (not admin)
    const { data, error } = await ctx.supabase.from('session').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      token: `token-${userId}-${crypto.randomUUID()}`,
      expires_at: expiresAt.toISOString(),
      created_at: nowIso,
      updated_at: nowIso,
      ip_address: ipAddress,
      user_agent: 'Mozilla/5.0 (Test Browser)',
    }).select()

    if (error) throw error
    return data?.[0]
  }

  it('should allow User 1 to see only their own sessions', async () => {
    await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.1')
    await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.2')

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: sessions, error } = await ctx.supabase.from('session').select('*')

    expect(error).toBeNull()
    expect(sessions).toHaveLength(2)
    sessions?.forEach((session: any) => {
      expect(session.user_id).toBe(ctx.USER_1_ID)
    })
  })

  it('should allow User 2 to see only their own sessions', async () => {
    await createTestSessionAsUser(ctx.USER_2_SESSION, ctx.USER_2_ID, '10.0.0.1')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: sessions, error } = await ctx.supabase.from('session').select('*')

    expect(error).toBeNull()
    expect(sessions).toHaveLength(1)
    expect(sessions?.[0].user_id).toBe(ctx.USER_2_ID)
  })

  it('should prevent User 2 from seeing User 1 sessions', async () => {
    const user1Session = await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.1')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: sessions } = await ctx.supabase
      .from('session')
      .select('*')
      .eq('id', user1Session.id)

    expect(sessions).toEqual([])
  })

  it('should prevent User 2 from modifying User 1 sessions', async () => {
    const user1Session = await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.1')
    const originalIp = user1Session.ip_address

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    await ctx.supabase
      .from('session')
      .update({ ip_address: '1.1.1.1' })
      .eq('id', user1Session.id)

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifySession } = await ctx.supabase
      .from('session')
      .select('ip_address')
      .eq('id', user1Session.id)

    expect(verifySession?.[0]?.ip_address).toBe(originalIp)
  })

  it('should allow User 1 to delete their own sessions', async () => {
    const sessionToDelete = await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.1')

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    // Verify it exists before deletion (as User 1)
    const { data: verifyExists1 } = await ctx.supabase
      .from('session')
      .select('id')
      .eq('id', sessionToDelete.id)

    expect(verifyExists1).toHaveLength(1)

    // Delete as User 1
    const { error } = await ctx.supabase
      .from('session')
      .delete()
      .eq('id', sessionToDelete.id)

    expect(error).toBeNull()

    // Verify it's gone (as User 1)
    const { data: verifyDelete } = await ctx.supabase
      .from('session')
      .select('id')
      .eq('id', sessionToDelete.id)

    expect(verifyDelete).toHaveLength(0)
  })

  it('should prevent User 2 from deleting User 1 sessions', async () => {
    const sessionToDelete = await createTestSessionAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, '192.168.1.1')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    // Try to delete as User 2
    const { error: deleteError } = await ctx.supabase
      .from('session')
      .delete()
      .eq('id', sessionToDelete.id)

    // RLS silently blocks deletes (no error, just 0 rows affected)
    // So verify the session still exists
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyExists } = await ctx.supabase
      .from('session')
      .select('id')
      .eq('id', sessionToDelete.id)

    expect(verifyExists).toHaveLength(1)
  })
})