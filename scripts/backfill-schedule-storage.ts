/**
 * Store MSP XML in storage for projects that have tasks but no stored file.
 * Usage: npx tsx scripts/backfill-schedule-storage.ts
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
import { exportMspXmlFromProject } from '../lib/schedule/msp-export'
import { storeScheduleXml } from '../lib/schedule/schedule-files'

const NOOR_ID = '023edfc0-6021-4969-a419-b3bdf2ee88fd'

async function main() {
  const supabase = createServiceClient()
  const { data: importRow } = await supabase
    .from('schedule_imports')
    .select('id, file_name, project_id')
    .eq('project_id', NOOR_ID)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!importRow) {
    throw new Error('No completed import for Noor')
  }

  const { xml } = await exportMspXmlFromProject(supabase, NOOR_ID)
  const path = await storeScheduleXml(importRow.project_id, importRow.id, xml)
  console.log('Stored', path, 'bytes', xml.length)

  const { error } = await supabase
    .from('schedule_imports')
    .update({ storage_path: path, storage_bucket: 'project-schedules' })
    .eq('id', importRow.id)

  if (error) {
    console.warn('storage_path update skipped:', error.message)
  } else {
    console.log('Updated schedule_imports.storage_path')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
