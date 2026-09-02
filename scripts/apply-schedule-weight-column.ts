/**
 * Adds project_tasks.schedule_weight (migration 66).
 * Usage: npx tsx scripts/apply-schedule-weight-column.ts
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

import { createServiceClient } from '../lib/supabase/service'

async function main() {
  const sql = readFileSync(resolve(process.cwd(), 'database/66-schedule-task-weight.sql'), 'utf8')
  const supabase = createServiceClient()

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
  if (error) {
    // Fallback: direct Postgres via REST often unavailable — print manual steps
    console.error('Auto-apply failed:', error.message)
    console.log('\nRun this in Supabase SQL Editor:\n')
    console.log(sql)
    process.exit(1)
  }

  console.log('schedule_weight column applied successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
