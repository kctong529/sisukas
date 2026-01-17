// tests/rls.favourites.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import { setUser1Session, setUser2Session } from './rls.session-helper'

describe.sequential('Favourites RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  async function createTestFavouriteAsUser(userSession: any, userId: string, courseId: string, notes: string) {
    await ctx.supabase.auth.setSession(userSession)

    const { data, error } = await ctx.supabase.from('favourites').insert({
      user_id: userId,
      course_id: courseId,
      notes: notes,
    }).select()

    if (error) {
      console.error('Insert error:', error)
      throw error
    }

    return data?.[0]
  }

  it('should allow User 1 to see only their own favourites', async () => {
    await createTestFavouriteAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', 'User 1 Favourite 1')
    await createTestFavouriteAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'MATH-201', 'User 1 Favourite 2')

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: favourites, error } = await ctx.supabase.from('favourites').select('*')

    expect(error).toBeNull()
    expect(favourites).toHaveLength(2)
    favourites?.forEach((fav: any) => {
      expect(fav.user_id).toBe(ctx.USER_1_ID)
    })
  })

  it('should allow User 2 to see only their own favourites', async () => {
    await createTestFavouriteAsUser(ctx.USER_2_SESSION, ctx.USER_2_ID, 'CS-101', 'User 2 Favourite 1')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: favourites, error } = await ctx.supabase.from('favourites').select('*')

    expect(error).toBeNull()
    expect(favourites).toHaveLength(1)
    expect(favourites?.[0].user_id).toBe(ctx.USER_2_ID)
  })

  it('should prevent User 2 from seeing User 1 favourites', async () => {
    const user1Fav = await createTestFavouriteAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', 'User 1 Favourite 1')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: favourites } = await ctx.supabase
      .from('favourites')
      .select('*')
      .eq('id', user1Fav.id)

    expect(favourites).toEqual([])
  })

  it('should allow User 1 to create their own favourite', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { error } = await ctx.supabase.from('favourites').insert({
      user_id: ctx.USER_1_ID,
      course_id: 'PHYS-301',
      notes: 'New favourite',
    })

    expect(error).toBeNull()
  })

  it('should prevent User 2 from modifying User 1 favourites', async () => {
    const user1Fav = await createTestFavouriteAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', 'User 1 Favourite 1')
    const originalNotes = user1Fav.notes

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    await ctx.supabase
      .from('favourites')
      .update({ notes: 'Hacked!' })
      .eq('id', user1Fav.id)

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyFav } = await ctx.supabase
      .from('favourites')
      .select('notes')
      .eq('id', user1Fav.id)

    expect(verifyFav?.[0]?.notes).toBe(originalNotes)
    expect(verifyFav?.[0]?.notes).not.toBe('Hacked!')
  })

  it('should prevent User 2 from creating favourites for User 1', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { error } = await ctx.supabase.from('favourites').insert({
      user_id: ctx.USER_1_ID,
      course_id: 'FAKE-999',
      notes: 'Fake favourite',
    })

    expect(error).not.toBeNull()
  })
})