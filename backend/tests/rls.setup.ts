// tests/rls.setup.ts
// Shared setup and teardown for all RLS tests
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export interface RLSTestContext {
  USER_1_ID: string
  USER_2_ID: string
  USER_1_SESSION: any
  USER_2_SESSION: any
  adminSupabase: any
  supabase: any
}

export async function setupRLSTest(): Promise<RLSTestContext> {
  const USER_1_ID = crypto.randomUUID()
  const USER_2_ID = crypto.randomUUID()

  const supabaseUrl = process.env.SUPABASE_URL!
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!
  const supabaseServiceRoleKey = process.env.SERVICE_ROLE_KEY!

  // Create fresh clients with no cached auth state
  const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Create test users in auth
  try {
    await adminSupabase.auth.admin.createUser({
      id: USER_1_ID,
      email: `user1-${USER_1_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })
  } catch (error) {
    console.error('[RLS Setup] ✗ Error creating auth user 1:', error)
    throw error
  }

  try {
    await adminSupabase.auth.admin.createUser({
      id: USER_2_ID,
      email: `user2-${USER_2_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })
  } catch (error) {
    console.error('[RLS Setup] ✗ Error creating auth user 2:', error)
    throw error
  }

  // Create users in the user table
  const { error: insertError } = await adminSupabase.from('user').insert([
    {
      id: USER_1_ID,
      email: `user1-${USER_1_ID}@test.com`,
      name: 'Test User 1',
      email_verified: true,
    },
    {
      id: USER_2_ID,
      email: `user2-${USER_2_ID}@test.com`,
      name: 'Test User 2',
      email_verified: true,
    },
  ])

  if (insertError) {
    console.error('[RLS Setup] ✗ Error inserting users:', insertError)
    throw insertError
  }
  
  const { data: user1SignIn, error: user1Error } = await adminSupabase.auth.signInWithPassword({
    email: `user1-${USER_1_ID}@test.com`,
    password: 'password123',
  })

  if (user1Error || !user1SignIn.session) {
    console.error('[RLS Setup] ✗ Failed to sign in user 1:', user1Error)
    throw new Error(`Sign in failed for user 1: ${user1Error?.message}`)
  }

  const { data: user2SignIn, error: user2Error } = await adminSupabase.auth.signInWithPassword({
    email: `user2-${USER_2_ID}@test.com`,
    password: 'password123',
  })

  if (user2Error || !user2SignIn.session) {
    console.error('[RLS Setup] ✗ Failed to sign in user 2:', user2Error)
    throw new Error(`Sign in failed for user 2: ${user2Error?.message}`)
  }

  return {
    USER_1_ID,
    USER_2_ID,
    USER_1_SESSION: user1SignIn.session,
    USER_2_SESSION: user2SignIn.session,
    adminSupabase,
    supabase,
  }
}

export async function teardownRLSTest(context: RLSTestContext): Promise<void> {
  const { USER_1_ID, USER_2_ID, adminSupabase } = context

  // Sign out to clear any session context
  try {
    await adminSupabase.auth.signOut()
  } catch (error) {
    console.warn('[RLS Cleanup] ⚠ Warning: Failed to sign out:', error)
  }

  // Create a fresh admin client with no session for cleanup
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SERVICE_ROLE_KEY!
  
  const cleanupAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Delete in reverse dependency order
    const { error: plansError } = await cleanupAdmin
      .from('plans')
      .delete()
      .in('user_id', [USER_1_ID, USER_2_ID])

    if (plansError) {
      console.error('[RLS Cleanup] ✗ Error deleting plans:', plansError)
      throw plansError
    }

    const { error: favError, count: favCount } = await cleanupAdmin
      .from('favourites')
      .delete()
      .in('user_id', [USER_1_ID, USER_2_ID])

    if (favError) {
      console.error('[RLS Cleanup] ✗ Error deleting favourites:', favError)
      throw favError
    }
    const { error: feedbackError, count: feedbackCount } = await cleanupAdmin
      .from('feedback')
      .delete()
      .in('user_id', [USER_1_ID, USER_2_ID])

    if (feedbackError) {
      console.error('[RLS Cleanup] ✗ Error deleting feedback:', feedbackError)
      throw feedbackError
    }
    const { error: accountError, count: accountCount } = await cleanupAdmin
      .from('account')
      .delete()
      .in('user_id', [USER_1_ID, USER_2_ID])

    if (accountError) {
      console.error('[RLS Cleanup] ✗ Error deleting accounts:', accountError)
      throw accountError
    }

    const { error: sessionError, count: sessionCount } = await cleanupAdmin
      .from('session')
      .delete()
      .in('user_id', [USER_1_ID, USER_2_ID])

    if (sessionError) {
      console.error('[RLS Cleanup] ✗ Error deleting sessions:', sessionError)
      throw sessionError
    }

    const { error: userError, count: userCount } = await cleanupAdmin
      .from('user')
      .delete()
      .in('id', [USER_1_ID, USER_2_ID])

    if (userError) {
      console.error('[RLS Cleanup] ✗ Error deleting user profiles:', userError)
      throw userError
    }

    try {
      await cleanupAdmin.auth.admin.deleteUser(USER_1_ID, true)
    } catch (authError) {
      console.warn(`[RLS Cleanup] ⚠ Warning deleting auth user ${USER_1_ID}:`, authError)
    }

    try {
      await cleanupAdmin.auth.admin.deleteUser(USER_2_ID, true)
    } catch (authError) {
      console.warn(`[RLS Cleanup] ⚠ Warning deleting auth user ${USER_2_ID}:`, authError)
    }
  } catch (error) {
    console.error(error)
    // Don't throw - let tests continue, but data cleanup failed
  }
}