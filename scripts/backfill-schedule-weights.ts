/**
 * Restore schedule_weight from the latest stored MSP XML for a project.
 * Usage: npx tsx scripts/backfill-schedule-weights.ts [projectId]
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
import { backfillScheduleWeightsFromStoredXml } from '../features/schedule/lib/schedule-weight-backfill'

const DEFAULT_PROJECT_ID = '023edfc0-6021-4969-a419-b3bdf2ee88fd'

async function main() {
  const projectId = process.argv[2] ?? DEFAULT_PROJECT_ID
  const supabase = createServiceClient()

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
  console.log(`Backfill weights for: ${project?.name ?? projectId}`)

  const result = await backfillScheduleWeightsFromStoredXml(supabase, projectId)
  console.log(result)

  if (result.source === 'none') {
    console.log('No stored XML — re-upload the original MSP file with وزن field.')
    process.exit(1)
  }

  if (result.tasksWithWeight === 0) {
    console.log('Stored XML has no weight values — re-upload original MSP export from Project.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
