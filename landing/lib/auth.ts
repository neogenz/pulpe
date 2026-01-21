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
 * Get all cookies matching a prefix (handles chunked cookies)
 * Supabase may split large cookies into chunks: sb-xxx-auth-token.0, sb-xxx-auth-token.1, etc.
 */
function getCookieValue(baseName: string): string | null {
  const cookies = document.cookie

  // Try direct match first
  const directMatch = cookies.match(new RegExp(`${baseName}=([^;]+)`))
  if (directMatch) {
    return decodeURIComponent(directMatch[1])
  }

  // Try chunked cookies (sb-xxx-auth-token.0, sb-xxx-auth-token.1, etc.)
  const chunks: string[] = []
  let i = 0
  while (true) {
    const chunkMatch = cookies.match(new RegExp(`${baseName}\\.${i}=([^;]+)`))
    if (!chunkMatch) break
    chunks.push(decodeURIComponent(chunkMatch[1]))
    i++
  }

  if (chunks.length > 0) {
    return chunks.join('')
  }

  return null
}

/**
 * Check if user has a valid Supabase auth session cookie
 * Cookie format: sb-{projectRef}-auth-token (may be chunked)
 */
export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const projectRef = getProjectRef()

  // Debug logging (will be removed after fix)
  console.log('[Auth Debug] SUPABASE_URL:', SUPABASE_URL)
  console.log('[Auth Debug] Project ref:', projectRef)
  console.log('[Auth Debug] All cookies:', document.cookie)

  if (!projectRef) {
    console.log('[Auth Debug] No project ref found')
    return false
  }

  const cookieName = `sb-${projectRef}-auth-token`
  console.log('[Auth Debug] Looking for cookie:', cookieName)

  const cookieValue = getCookieValue(cookieName)
  console.log('[Auth Debug] Cookie value found:', cookieValue ? 'yes' : 'no')

  if (!cookieValue) {
    return false
  }

  try {
    const session = JSON.parse(cookieValue) as {
      access_token?: string
      expires_at?: number
    }

    console.log('[Auth Debug] Session parsed:', {
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at,
    })

    if (!session?.access_token) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const EXPIRY_BUFFER_SECONDS = 60

    if (session.expires_at && session.expires_at < now + EXPIRY_BUFFER_SECONDS) {
      console.log('[Auth Debug] Session expired')
      return false
    }

    console.log('[Auth Debug] User is authenticated!')
    return true
  } catch (error) {
    console.log('[Auth Debug] Parse error:', error)
    return false
  }
}
