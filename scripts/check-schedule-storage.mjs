import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env.local')
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

const NOOR = '023edfc0-6021-4969-a419-b3bdf2ee88fd'
const { data } = await supabase
  .from('schedule_imports')
  .select('id, file_name, storage_path, storage_bucket')
  .eq('project_id', NOOR)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

console.log(data)

if (data?.storage_path) {
  const { data: file, error } = await supabase.storage
    .from('project-schedules')
    .download(data.storage_path)
  console.log('storage file', file?.size, error?.message)
}
