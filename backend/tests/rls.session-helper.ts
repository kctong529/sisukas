// tests/rls.session-helper.ts
// Simple helper to set session from pre-created context sessions

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Set User 1's session on the Supabase client
 * Call this at the start of each test that needs User 1 authentication
 */
export async function setUser1Session(supabaseClient: SupabaseClient, session: any): Promise<void> {
  if (!session) {
    throw new Error('User 1 session not available')
  }
  await supabaseClient.auth.setSession(session)
}

/**
 * Set User 2's session on the Supabase client
 * Call this at the start of each test that needs User 2 authentication
 */
export async function setUser2Session(supabaseClient: SupabaseClient, session: any): Promise<void> {
  if (!session) {
    throw new Error('User 2 session not available')
  }
  await supabaseClient.auth.setSession(session)
}

/**
 * Clear the current session
 */
export async function clearSession(supabaseClient: SupabaseClient): Promise<void> {
  await supabaseClient.auth.signOut()
}