// tests/rls.user.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import { setUser1Session, setUser2Session } from './rls.session-helper'

describe.sequential('User Profile RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  it('should allow User 1 to see only their own profile', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: users, error } = await ctx.supabase.from('user').select('*')

    expect(error).toBeNull()
    expect(users).toHaveLength(1)
    expect(users?.[0].id).toBe(ctx.USER_1_ID)
    expect(users?.[0].name).toBe('Test User 1')
  })

  it('should allow User 2 to see only their own profile', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: users, error } = await ctx.supabase.from('user').select('*')

    expect(error).toBeNull()
    expect(users).toHaveLength(1)
    expect(users?.[0].id).toBe(ctx.USER_2_ID)
    expect(users?.[0].name).toBe('Test User 2')
  })

  it('should prevent User 2 from seeing User 1 profile', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: users } = await ctx.supabase
      .from('user')
      .select('*')
      .eq('id', ctx.USER_1_ID)

    expect(users).toEqual([])
  })

  it('should allow User 1 to update their own profile', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { error } = await ctx.supabase
      .from('user')
      .update({ name: 'Alice Updated' })
      .eq('id', ctx.USER_1_ID)

    expect(error).toBeNull()

    // Verify by querying as User 1 (the owner)
    const { data: users } = await ctx.supabase
      .from('user')
      .select('name')
      .eq('id', ctx.USER_1_ID)

    expect(users?.[0]?.name).toBe('Alice Updated')
  })

  it('should prevent User 2 from modifying User 1 profile', async () => {
    // Get User 1's original name
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: user1Before } = await ctx.supabase
      .from('user')
      .select('name')
      .eq('id', ctx.USER_1_ID)

    const originalName = user1Before?.[0]?.name

    // Try to modify as User 2
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)
    await ctx.supabase
      .from('user')
      .update({ name: 'Hacked!' })
      .eq('id', ctx.USER_1_ID)

    // Verify the update didn't happen by checking as User 1
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: user1After } = await ctx.supabase
      .from('user')
      .select('name')
      .eq('id', ctx.USER_1_ID)

    expect(user1After?.[0]?.name).toBe(originalName)
    expect(user1After?.[0]?.name).not.toBe('Hacked!')
  })

  it('should allow User 1 to delete their own account', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    // Verify user exists before deletion
    const { data: beforeDelete } = await ctx.supabase
      .from('user')
      .select('id')
      .eq('id', ctx.USER_1_ID)

    expect(beforeDelete).toHaveLength(1)

    // Delete their own account
    const { error: deleteError } = await ctx.supabase
      .from('user')
      .delete()
      .eq('id', ctx.USER_1_ID)

    expect(deleteError).toBeNull()

    // Verify deletion by checking they can't see their own profile anymore
    const { data: afterDelete } = await ctx.supabase
      .from('user')
      .select('id')
      .eq('id', ctx.USER_1_ID)

    expect(afterDelete).toHaveLength(0)
  })

  it('should prevent User 2 from deleting User 1 account', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    // Try to delete User 1
    await ctx.supabase
      .from('user')
      .delete()
      .eq('id', ctx.USER_1_ID)

    // Verify User 1 still exists by checking as User 1
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyExists } = await ctx.supabase
      .from('user')
      .select('id')
      .eq('id', ctx.USER_1_ID)

    expect(verifyExists).toHaveLength(1)
  })
})