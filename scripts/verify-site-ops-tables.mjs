/**
 * Verify site-ops tables exist (service role, head-only).
 * Run: node scripts/verify-site-ops-tables.mjs
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const env = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnvLocal()
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const tables = [
  'site_ops_cre_runs',
  'site_ops_operational_tasks',
  'site_ops_crews',
  'site_ops_daily_plans',
  'site_ops_work_orders',
  'site_ops_actual_entries',
  'site_ops_audit_log',
  'site_ops_role_grants',
  'site_ops_daily_reports',
  'site_ops_constraint_logs',
]

let failed = 0
for (const table of tables) {
  const { error, count } = await sb.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    failed += 1
    console.log(`FAIL  ${table}: ${error.message}`)
  } else {
    console.log(`OK    ${table} (rows=${count ?? 0})`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} table(s) missing or inaccessible.`)
  process.exit(1)
}
console.log('\nSite-ops tables look applied.')
