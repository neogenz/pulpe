const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

/**
 * Extract project reference from Supabase URL
 * Example: https://abcd1234.supabase.co → abcd1234
 */
function getProjectRef(): string | null {
  const match = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase/)
  return match?.[1] ?? null
}

/**
 * Check if user has a valid Supabase auth session cookie
 * Cookie format: sb-{projectRef}-auth-token
 */
export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const projectRef = getProjectRef()
  if (!projectRef) {
    return false
  }

  const cookieName = `sb-${projectRef}-auth-token`
  const cookies = document.cookie
  const cookieMatch = cookies.match(new RegExp(`${cookieName}=([^;]+)`))

  if (!cookieMatch) {
    return false
  }

  try {
    const session = JSON.parse(decodeURIComponent(cookieMatch[1])) as {
      access_token?: string
      expires_at?: number
    }

    if (!session?.access_token) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const EXPIRY_BUFFER_SECONDS = 60

    if (session.expires_at && session.expires_at < now + EXPIRY_BUFFER_SECONDS) {
      return false
    }

    return true
  } catch {
    return false
  }
}
