import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const env = {}
  for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnvLocal()
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error, count } = await sb
  .schema('qc_engine')
  .from('inspectable_item')
  .select('*', { count: 'exact', head: true })

if (error) {
  console.log(`FAIL  qc_engine.inspectable_item: ${error.message}`)
  process.exit(1)
}
console.log(`OK    qc_engine.inspectable_item (rows=${count ?? 0})`)
