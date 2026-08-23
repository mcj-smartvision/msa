/**
 * Confirm project_drawings table + bucket after migration 58.
 * Run: node scripts/verify-project-drawings.mjs
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const env = {}
  for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnvLocal()
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error: tableError, count } = await sb
  .from('project_drawings')
  .select('*', { count: 'exact', head: true })

if (tableError) {
  console.log(`FAIL  project_drawings: ${tableError.message}`)
  process.exit(1)
}
console.log(`OK    project_drawings (rows=${count ?? 0})`)

const { data: buckets, error: bucketError } = await sb.storage.listBuckets()
if (bucketError) {
  console.log(`FAIL  buckets: ${bucketError.message}`)
  process.exit(1)
}
const found = (buckets ?? []).some((b) => b.name === 'project-drawings')
if (!found) {
  console.log('FAIL  bucket project-drawings missing')
  process.exit(1)
}
console.log('OK    bucket project-drawings')
