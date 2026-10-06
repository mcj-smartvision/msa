/**
 * Copy Vegas MSP schedule to برج اداری نور and apply Vegas actual start.
 * Usage: npx tsx scripts/copy-vegas-schedule-to-noor.ts
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
import { exportMspXmlFromProject } from '../features/schedule/lib/msp-export'
import { importMspScheduleToProject } from '../features/schedule/lib/msp-import'
import { applyActualStartToSchedule } from '../features/schedule/lib/apply-actual-start'

const VEGAS_ID = '1684afec-83cf-488a-956a-c2a36189cf2b'
const NOOR_ID = '023edfc0-6021-4969-a419-b3bdf2ee88fd'

async function main() {
  const supabase = createServiceClient()

  const { data: vegas } = await supabase
    .from('projects')
    .select('name, schedule_actual_start')
    .eq('id', VEGAS_ID)
    .maybeSingle()

  const { data: noor } = await supabase.from('projects').select('name').eq('id', NOOR_ID).maybeSingle()

  if (!vegas || !noor) {
    throw new Error('Vegas or Noor project not found')
  }

  console.log(`Exporting schedule from ${vegas.name}…`)
  const { xml, fileName } = await exportMspXmlFromProject(supabase, VEGAS_ID)
  console.log(`XML size: ${xml.length} bytes, file: ${fileName}`)

  console.log(`Importing into ${noor.name}…`)
  const result = await importMspScheduleToProject(supabase, NOOR_ID, fileName, xml, null)
  console.log('Import result:', result)

  const actualStart = vegas.schedule_actual_start
  if (actualStart) {
    console.log(`Applying actual start ${actualStart}…`)
    const applied = await applyActualStartToSchedule(supabase, {
      projectId: NOOR_ID,
      actualStartDate: actualStart,
      alignedWithBaseline: false,
    })
    console.log('Reschedule:', applied.shift_days, 'days')
  }

  const { count } = await supabase
    .from('project_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', NOOR_ID)

  console.log(`Noor task count: ${count}`)
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
