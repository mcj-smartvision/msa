/** Internal domain for username-only logins (Supabase Auth requires an email). */
export const LOGIN_EMAIL_DOMAIN = 'site.local'

/** Convert username or email to Supabase auth email. Plain "sahar" → sahar@site.local */
export function normalizeLoginIdentifier(input: string): string {
  const value = input.trim().toLowerCase()
  if (!value) return value
  if (value.includes('@')) return value
  return `${value}@${LOGIN_EMAIL_DOMAIN}`
}

/** Show sahar@site.local as sahar in admin UI */
export function formatLoginDisplay(email: string): string {
  const value = email.trim().toLowerCase()
  const suffix = `@${LOGIN_EMAIL_DOMAIN}`
  if (value.endsWith(suffix)) {
    return value.slice(0, -suffix.length)
  }
  return email
}

export function isPlainUsername(input: string): boolean {
  return input.trim().length > 0 && !input.includes('@')
}

export function isSiteLocalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`)
}

/** Real mailbox suitable for outbound notifications */
export function isDeliverableEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const value = email.trim().toLowerCase()
  return value.includes('@') && !value.endsWith(`@${LOGIN_EMAIL_DOMAIN}`)
}

/** Prefer contact_email, then login email if it is a real mailbox */
export function resolveNotifyEmail(opts: {
  contactEmail?: string | null
  email?: string | null
}): string | null {
  if (isDeliverableEmail(opts.contactEmail)) return opts.contactEmail!.trim().toLowerCase()
  if (isDeliverableEmail(opts.email)) return opts.email!.trim().toLowerCase()
  return null
}
