/**
 * Full Supabase/Postgres backup (schema + data) via pg_dump.
 *
 * Windows often cannot reach Supabase **Direct** (IPv6 only). Prefer Session pooler:
 * Supabase → Connect → Session pooler → URI (port 5432, user postgres.[PROJECT_REF])
 *
 * Run: npm run backup
 */
import { execFileSync, spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function findPgDump() {
  const direct = spawnSync('pg_dump', ['--version'], { encoding: 'utf8', shell: true })
  if (direct.status === 0) return 'pg_dump'

  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL'
    if (existsSync(base)) {
      // Newest first: pg_dump must not be older than the Supabase server.
      const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a))
      for (const dir of versions) {
        const candidate = join(base, dir, 'bin', 'pg_dump.exe')
        if (existsSync(candidate)) return candidate
      }
    }
  }
  return null
}

function projectRefFromEnv(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (m) return m[1]
  return env.SUPABASE_PROJECT_REF || null
}

function projectRefFromDbUrl(url) {
  const m = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)
  return m?.[1] ?? null
}

function validateDatabaseUrl(url) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('supabase')) {
      console.error('❌ DATABASE_URL باید مربوط به Supabase باشد.')
      process.exit(1)
    }
    if (!parsed.password) {
      console.error('❌ رمز دیتابیس در URL نیست یا @ داخل رمز encode نشده.')
      console.error('   مثال: ssM@123 → ssM%40123')
      process.exit(1)
    }
    return parsed
  } catch {
    console.error('❌ DATABASE_URL نامعتبر است.')
    console.error('   اگر رمز @ دارد، آن را به %40 تبدیل کن.')
    process.exit(1)
  }
}

function buildSessionPoolerUrl(parsed, projectRef, poolerHost) {
  const u = new URL(parsed.toString())
  u.username = `postgres.${projectRef}`
  u.hostname = poolerHost
  u.port = '5432'
  return u.toString()
}

function candidateUrls(parsed, env) {
  const urls = [parsed.toString()]
  const poolerFromEnv = env.DATABASE_POOLER_URL || process.env.DATABASE_POOLER_URL
  if (poolerFromEnv) urls.unshift(poolerFromEnv)

  const ref = projectRefFromDbUrl(parsed) || projectRefFromEnv(env)
  if (!ref) return urls

  const hosts = [
    env.SUPABASE_POOLER_HOST,
    process.env.SUPABASE_POOLER_HOST,
    'aws-1-ca-central-1.pooler.supabase.com',
    'aws-0-ca-central-1.pooler.supabase.com',
  ].filter(Boolean)

  for (const host of hosts) {
    urls.push(buildSessionPoolerUrl(parsed, ref, host))
  }

  return [...new Set(urls)]
}

function maskUrl(url) {
  try {
    const u = new URL(url)
    if (u.password) u.password = '****'
    return u.toString()
  } catch {
    return '(invalid URL)'
  }
}

function runPgDump(pgDump, databaseUrl, backupPath) {
  // Options first, connection last — avoids "too many command-line arguments" on Windows
  const result = spawnSync(
    pgDump,
    ['-Fp', '--no-owner', '--no-acl', '-f', backupPath, '-d', databaseUrl],
    {
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE || 'require' },
    }
  )
  if (result.status !== 0) {
    const err = new Error(result.stderr || result.stdout || 'pg_dump failed')
    err.stderr = result.stderr
    throw err
  }
}

const envFile = loadEnvLocal()
const rawUrl = process.env.DATABASE_URL || envFile.DATABASE_URL
const parsed = validateDatabaseUrl(rawUrl)
const pgDump = findPgDump()

if (!rawUrl || rawUrl.includes('YOUR_') || rawUrl.includes('your-')) {
  console.error('❌ DATABASE_URL تنظیم نشده.')
  process.exit(1)
}

if (!pgDump) {
  console.error('❌ pg_dump پیدا نشد. PostgreSQL را نصب کن و ترمینال را ری‌استارت کن.')
  process.exit(1)
}

const backupDir = join(process.cwd(), 'backups')
if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupPath = join(backupDir, `backup-${timestamp}.sql`)
const urls = candidateUrls(parsed, envFile)

console.log('🚀 شروع بکاپ دیتابیس…')

let lastError = null
for (const url of urls) {
  console.log(`   تلاش: ${maskUrl(url)}`)
  try {
    runPgDump(pgDump, url, backupPath)
    const sizeMb = (statSync(backupPath).size / (1024 * 1024)).toFixed(2)
    console.log(`\n✅ بکاپ ذخیره شد (${sizeMb} MB):`)
    console.log(`   ${backupPath}`)
    console.log('\n📦 بازیابی: psql "NEW_DATABASE_URL" -f backups/backup-....sql')
    if (url !== rawUrl) {
      console.log('\n💡 این بکاپ با Session pooler گرفته شد (Direct روی IPv6 ویندوز کار نمی‌کند).')
      console.log('   برای دفعات بعد DATABASE_POOLER_URL را در .env.local بگذار.')
    }
    process.exit(0)
  } catch (error) {
    lastError = error
    const msg = String(error.stderr || error.message || error)
    if (msg.includes('server version mismatch')) {
      console.log('   ↳ نسخه pg_dump قدیمی است؛ بکاپ منطقی با Python…')
      try {
        execFileSync('python', ['scripts/backup-logical.py'], {
          stdio: 'inherit',
          cwd: process.cwd(),
          shell: true,
        })
        process.exit(0)
      } catch (pyErr) {
        lastError = pyErr
        break
      }
    }
    if (msg.includes('Connection refused') || msg.includes('ENOTFOUND') || msg.includes('timeout')) {
      console.log('   ↳ ناموفق، تلاش بعدی…')
      continue
    }
    break
  }
}

console.error('\n❌ بکاپ ناموفق بود.')
console.error('   • Supabase → Connect → Session pooler → URI را در .env.local بگذار:')
console.error('     DATABASE_POOLER_URL=postgresql://postgres.[REF]:[PASS]@aws-0-ca-central-1.pooler.supabase.com:5432/postgres')
console.error('   • رمز با @ باید %40 باشد')
console.error('   • Supabase → Database → Network → IP خودت را allow کن')
if (lastError?.stderr) console.error(String(lastError.stderr))
process.exit(1)
