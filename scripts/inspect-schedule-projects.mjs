import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) {
  console.error('No .env.local')
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: projects, error } = await supabase
  .from('projects')
  .select('id, name, code, schedule_baseline_start, schedule_actual_start')
  .order('name')

if (error) {
  console.error(error)
  process.exit(1)
}

for (const p of projects ?? []) {
  const name = String(p.name ?? '')
  const lower = name.toLowerCase()
  if (
    lower.includes('vegas') ||
    name.includes('نور') ||
    lower.includes('noor') ||
    name.includes('برج')
  ) {
    const { count } = await supabase
      .from('project_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id)
    const { data: imports } = await supabase
      .from('schedule_imports')
      .select('id, file_name, status, tasks_imported, created_at')
      .eq('project_id', p.id)
      .order('created_at', { ascending: false })
      .limit(3)
    console.log('---')
    console.log(JSON.stringify({ ...p, taskCount: count, imports }, null, 2))
  }
}
