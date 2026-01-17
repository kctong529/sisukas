// tests/rls.feedback.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { setupRLSTest, teardownRLSTest, RLSTestContext } from './rls.setup'
import { setUser1Session, setUser2Session } from './rls.session-helper'

describe.sequential('Feedback RLS', () => {
  let ctx: RLSTestContext

  beforeEach(async () => {
    ctx = await setupRLSTest()
  })

  afterEach(async () => {
    await teardownRLSTest(ctx)
  })

  async function createTestFeedbackAsUser(
    userSession: any,
    userId: string,
    courseId: string,
    rating: string,
    comment: string
  ) {
    await ctx.supabase.auth.setSession(userSession)

    const { data, error } = await ctx.supabase.from('feedback').insert({
      user_id: userId,
      course_id: courseId,
      rating: rating,
      comment: comment,
    }).select()

    if (error) {
      console.error('Insert error:', error)
      throw error
    }

    return data?.[0]
  }

  it('should allow User 1 to see only their own feedback', async () => {
    await createTestFeedbackAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', '5', 'Great course!')
    await createTestFeedbackAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'MATH-201', '4', 'Good content')

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { data: feedback, error } = await ctx.supabase.from('feedback').select('*')

    expect(error).toBeNull()
    expect(feedback).toHaveLength(2)
    feedback?.forEach((fb: any) => {
      expect(fb.user_id).toBe(ctx.USER_1_ID)
    })
  })

  it('should allow User 2 to see only their own feedback', async () => {
    await createTestFeedbackAsUser(ctx.USER_2_SESSION, ctx.USER_2_ID, 'CS-101', '3', 'Average')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: feedback, error } = await ctx.supabase.from('feedback').select('*')

    expect(error).toBeNull()
    expect(feedback).toHaveLength(1)
    expect(feedback?.[0].user_id).toBe(ctx.USER_2_ID)
  })

  it('should prevent User 2 from seeing User 1 feedback', async () => {
    const user1Feedback = await createTestFeedbackAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', '5', 'Great course!')

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { data: feedback } = await ctx.supabase
      .from('feedback')
      .select('*')
      .eq('id', user1Feedback.id)

    expect(feedback).toEqual([])
  })

  it('should allow User 1 to create their own feedback', async () => {
    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)

    const { error } = await ctx.supabase.from('feedback').insert({
      user_id: ctx.USER_1_ID,
      course_id: 'PHYS-301',
      rating: '5',
      comment: 'Excellent!',
    })

    expect(error).toBeNull()
  })

  it('should prevent User 2 from modifying User 1 feedback', async () => {
    const user1Feedback = await createTestFeedbackAsUser(ctx.USER_1_SESSION, ctx.USER_1_ID, 'CS-101', '5', 'Great course!')
    const originalComment = user1Feedback.comment

    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    await ctx.supabase
      .from('feedback')
      .update({ comment: 'Hacked!' })
      .eq('id', user1Feedback.id)

    await setUser1Session(ctx.supabase, ctx.USER_1_SESSION)
    const { data: verifyFeedback } = await ctx.supabase
      .from('feedback')
      .select('comment')
      .eq('id', user1Feedback.id)

    expect(verifyFeedback?.[0]?.comment).toBe(originalComment)
    expect(verifyFeedback?.[0]?.comment).not.toBe('Hacked!')
  })

  it('should prevent User 2 from creating feedback for User 1', async () => {
    await setUser2Session(ctx.supabase, ctx.USER_2_SESSION)

    const { error } = await ctx.supabase.from('feedback').insert({
      user_id: ctx.USER_1_ID,
      course_id: 'FAKE-999',
      rating: '1',
      comment: 'Fake feedback',
    })

    expect(error).not.toBeNull()
  })
})