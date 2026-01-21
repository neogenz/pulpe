import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Check if user has a valid Supabase auth session
 */
export async function isAuthenticated(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  console.log('[Auth Debug] SUPABASE_URL:', SUPABASE_URL)
  console.log('[Auth Debug] ANON_KEY exists:', !!SUPABASE_ANON_KEY)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('[Auth Debug] Missing env vars')
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { data, error } = await supabase.auth.getSession()
    console.log('[Auth Debug] getSession result:', {
      hasSession: !!data.session,
      hasAccessToken: !!data.session?.access_token,
      error: error?.message,
    })
    return !!data.session?.access_token
  } catch (err) {
    console.log('[Auth Debug] Error:', err)
    return false
  }
}
