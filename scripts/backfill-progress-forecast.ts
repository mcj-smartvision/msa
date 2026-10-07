/**
 * Re-forecast start_current / finish_current and sync percent and actual dates from the daily reports, then
 * roll the heading percents up, for one project or all.
 * `--dry` writes nothing; `--trace=<id part>` lists the day-by-day commitment windows of matching activities.
 * Usage: npx tsx scripts/backfill-progress-forecast.ts [--dry] [--trace=…] [projectId]
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
import { persistProgressForecast } from '../features/schedule/lib/persist-progress-forecast'
import { computeCommitmentWindows } from '../features/schedule/lib/week-commitments'

async function main() {
  const supabase = createServiceClient()
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry')
  const only = args.find((a) => !a.startsWith('--'))
  const trace = args.find((a) => a.startsWith('--trace='))?.slice('--trace='.length)
  const { data: projects, error } = only
    ? await supabase.from('projects').select('id, name').eq('id', only)
    : await supabase.from('projects').select('id, name')
  if (error) throw new Error(error.message)

  for (const project of projects ?? []) {
    const changes = await persistProgressForecast(supabase, project.id, { dryRun })
    console.log(`${project.name}: ${changes.length} change(s)`)
    for (const c of changes) {
      const span = c.field === 'percent' ? `${c.from} -> ${c.to}` : `${c.from.start}..${c.from.finish} -> ${c.to.start}..${c.to.finish}`
      console.log(`  ${c.wbs ?? c.id} ${c.field}: ${span}`)
    }
    if (!dryRun) await persistParentProgressRollup(supabase, project.id)
    if (trace) {
      const windows = await computeCommitmentWindows(supabase, project.id)
      for (const w of windows.filter((x) => x.activityId.includes(trace))) {
        console.log(`  from ${w.from}: ${w.start}..${w.finish}`)
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
