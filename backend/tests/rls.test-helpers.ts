// tests/rls.test-helpers.ts
// Helper functions for proper authentication in RLS tests

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sign in a user and properly set their session on the Supabase client.
 * This is critical for RLS policies to work correctly in tests.
 * 
 * @param supabaseClient - The Supabase client to sign in with
 * @param email - User email
 * @param password - User password
 * @throws Error if sign in fails or session cannot be set
 */
export async function signInUserWithSession(
  supabaseClient: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  // Sign in the user
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    console.error(`[Auth Helper] ✗ Sign in failed for ${email}:`, authError)
    throw new Error(`Sign in failed: ${authError.message}`)
  }

  if (!authData.session) {
    console.error(`[Auth Helper] ✗ Sign in succeeded but no session returned for ${email}`)
    throw new Error('Sign in did not return a session')
  }

  // CRITICAL: Set the session on the client so auth.uid() works in RLS policies
  const { error: setSessionError } = await supabaseClient.auth.setSession(authData.session)

  if (setSessionError) {
    console.error(`[Auth Helper] ✗ Failed to set session for ${email}:`, setSessionError)
    throw new Error(`Failed to set session: ${setSessionError.message}`)
  }

  // Verify the session was set correctly
  const { data: currentSession } = await supabaseClient.auth.getSession()
  const currentUser = currentSession.session?.user

  if (!currentUser || currentUser.id !== authData.user.id) {
    console.error(
      `[Auth Helper] ✗ Session mismatch for ${email}. Expected: ${authData.user.id}, Got: ${currentUser?.id}`
    )
    throw new Error('Session was not properly set on client')
  }

  console.log(`[Auth Helper] ✓ User signed in and session set: ${currentUser.id}`)
}

/**
 * Verify that the current user matches expected ID.
 * Useful for debugging RLS issues.
 * 
 * @param supabaseClient - The Supabase client to check
 * @param expectedUserId - The expected user ID
 * @throws Error if current user doesn't match expected
 */
export async function verifyCurrentUser(
  supabaseClient: SupabaseClient,
  expectedUserId: string
): Promise<void> {
  const { data: currentSession } = await supabaseClient.auth.getSession()
  const currentUserId = currentSession.session?.user?.id

  if (currentUserId !== expectedUserId) {
    throw new Error(
      `User mismatch: expected ${expectedUserId}, got ${currentUserId}`
    )
  }
}

/**
 * Get the current user's auth context info for debugging.
 * 
 * @param supabaseClient - The Supabase client to check
 */
export async function debugAuthContext(supabaseClient: SupabaseClient): Promise<void> {
  const { data: sessionData } = await supabaseClient.auth.getSession()
  const { data: userData } = await supabaseClient.auth.getUser()

  console.log('[Auth Debug]', {
    sessionUserId: sessionData.session?.user?.id,
    sessionExpiry: sessionData.session?.expires_at,
    userUserId: userData.user?.id,
    userEmail: userData.user?.email,
  })
}