// tests/rls.plan.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import { setUser1Session, setUser2Session } from './rls.session-helper'

describe.sequential('Plans RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    await ctx.supabase.from('plans').insert([
      { user_id: ctx.USER_1_ID, name: 'User 1 Plan', is_active: true },
    ])

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)
    await ctx.supabase.from('plans').insert([
      { user_id: ctx.USER_2_ID, name: 'User 2 Plan', is_active: true },
    ])
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  it('should allow User 1 to see only their own plans', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: plans, error } = await ctx.supabase.from('plans').select('*')

    expect(error).toBeNull()
    expect(plans).toHaveLength(1)
    expect(plans?.[0].user_id).toBe(ctx.USER_1_ID)
    expect(plans?.[0].name).toBe('User 1 Plan')
  })

  it('should allow User 2 to see only their own plans', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: plans, error } = await ctx.supabase.from('plans').select('*')

    expect(error).toBeNull()
    expect(plans).toHaveLength(1)
    expect(plans?.[0].user_id).toBe(ctx.USER_2_ID)
    expect(plans?.[0].name).toBe('User 2 Plan')
  })

  it('should prevent User 2 from seeing User 1 plans', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: user1Plans } = await ctx.supabase.from('plans').select('id').eq('user_id', ctx.USER_1_ID)
    const user1PlanId = user1Plans?.[0]?.id

    if (!user1PlanId) {
      throw new Error('User 1 plan not found')
    }

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)
    const { data: plans } = await ctx.supabase
      .from('plans')
      .select('*')
      .eq('id', user1PlanId)

    expect(plans).toEqual([])
  })

  it('should prevent User 2 from modifying User 1 plans', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: user1Plans } = await ctx.supabase
      .from('plans')
      .select('id, name')
      .eq('user_id', ctx.USER_1_ID)

    const user1PlanId = user1Plans?.[0]?.id
    const originalName = user1Plans?.[0]?.name

    if (!user1PlanId) {
      throw new Error('User 1 plan not found')
    }

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)
    await ctx.supabase
      .from('plans')
      .update({ name: 'Hacked!' })
      .eq('id', user1PlanId)

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyPlan } = await ctx.supabase
      .from('plans')
      .select('name')
      .eq('id', user1PlanId)

    expect(verifyPlan?.[0]?.name).toBe(originalName)
    expect(verifyPlan?.[0]?.name).not.toBe('Hacked!')
  })

  it('should allow User 1 to create their own plan', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { error } = await ctx.supabase.from('plans').insert({
      user_id: ctx.USER_1_ID,
      name: 'New User 1 Plan',
      is_active: false,
    })

    expect(error).toBeNull()
  })

  it('should prevent User 2 from creating plans for User 1', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { error } = await ctx.supabase.from('plans').insert({
      user_id: ctx.USER_1_ID,
      name: 'Fake Plan for User 1',
      is_active: false,
    })

    expect(error).not.toBeNull()
  })
})