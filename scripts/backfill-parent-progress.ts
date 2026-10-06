/**
 * Re-derive the stored percent of every heading task from its children, for one project or all.
 * Usage: npx tsx scripts/backfill-parent-progress.ts [projectId]
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

import { createServiceClient } from '../shared/lib/supabase/service'
import { persistParentProgressRollup } from '../features/schedule/lib/persist-parent-progress'

async function main() {
  const supabase = createServiceClient()
  const only = process.argv[2]
  const { data: projects, error } = only
    ? await supabase.from('projects').select('id, name').eq('id', only)
    : await supabase.from('projects').select('id, name')
  if (error) throw new Error(error.message)

  for (const project of projects ?? []) {
    const updated = await persistParentProgressRollup(supabase, project.id)
    console.log(`${project.name}: ${updated} heading(s) updated`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
