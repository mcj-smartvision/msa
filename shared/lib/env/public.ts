/** Public environment variables (safe for client + server checks) */

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  return { url, anonKey, configured: Boolean(url && anonKey) }
}

export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

export function getPublicEnvStatus() {
  const supabase = getSupabasePublicConfig()
  return {
    supabaseConfigured: supabase.configured,
    supabaseUrlHost: supabase.url ? safeHost(supabase.url) : null,
    googleMapsConfigured: Boolean(getGoogleMapsApiKey()),
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}
