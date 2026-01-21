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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { data } = await supabase.auth.getSession()
    return !!data.session?.access_token
  } catch {
    return false
  }
}
