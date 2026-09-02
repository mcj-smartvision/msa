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

const NOOR = '023edfc0-6021-4969-a419-b3bdf2ee88fd'
const VEGAS = '1684afec-83cf-488a-956a-c2a36189cf2b'

async function main() {
  const supabase = createServiceClient()
  for (const id of [NOOR, VEGAS]) {
    const { data, error } = await supabase
      .from('project_tasks')
      .select('schedule_weight')
      .eq('project_id', id)
      .limit(500)
    if (error) {
      console.log(id, 'error', error.message)
      continue
    }
    const withW = (data ?? []).filter((r) => r.schedule_weight != null).length
    console.log(id, 'tasks', data?.length, 'with weight', withW)
  }
}

main().catch(console.error)
