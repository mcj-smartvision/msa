/**
 * Inserts @file headers into SitePilot TS/TSX without changing code.
 * Order: config/i18n/types → lib/services → components/hooks/app.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const DOMAIN_FA = {
  schedule: 'زمان‌بندی، WBS و گانت',
  'schedule-intelligence': 'تحلیل کیفیت برنامه و آپلود MSP',
  finance: 'حسابداری، هزینه،overhead و صورت‌وضعیت',
  storekeeper: 'انبار، موجودی و حواله مصالح',
  supervisor: 'سرپرست کارگاه و گزارش روزانه',
  'site-ops': 'عملیات کارگاه، دستورکار و برنامه روزانه',
  dashboard: 'داشبورد نقش‌ها و ویجت‌ها',
  manager: 'داشبورد مدیر پروژه و KPI',
  'project-manager': 'اتاق فرمان مدیر پروژه و کارتابل',
  evm: 'ارزش کسب‌شده (CPI، SPI، EAC)',
  'project-controls': 'موتور کنترل پروژه و شاخص‌های توضیح‌پذیر',
  'project-store': 'ذخیره پیشرفت و overlay اعداد داشبورد',
  admin: 'کنترل سنتر و مدیریت اعضا/پروژه',
  workshop: 'بسته‌های اجرایی و تأیید کارگاه',
  hse: 'ایمنی، بهداشت و محیط زیست',
  qc: 'کنترل کیفیت و عدم انطباق',
  attendance: 'حضور و غیاب و چهره',
  procurement: 'تدارکات',
  reports: 'گزارش‌ها و بایگانی',
  weather: 'هوای کارگاه',
  holidays: 'تقویم تعطیلات',
  'calc-trace': 'دفتر رد محاسبه شاخص‌ها',
  'technical-office': 'دفتر فنی',
  'cre-contract': 'قرارداد و پیمانکاران',
  'project-init': 'راه‌اندازی پروژه',
  security: 'امنیت و ثبت چهره',
  wwp: 'برنامه هفتگی متعهد (WWP)',
  compliance: 'انطباق',
  landing: 'صفحه فرود',
  account: 'حساب کاربری',
  shared: 'زیرساخت مشترک سامانه',
  app: 'مسیرها و layout',
}

const SKIP_DIR = new Set(['node_modules', '.next', 'android-accountant', 'dist'])

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name) || ent.name.startsWith('.')) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function posixRel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function layerOf(rel) {
  if (/(^|\/)(config|i18n|locales)(\/|$)/.test(rel) || /config\.ts$/.test(rel) || /\/types\.ts$/.test(rel) || /\/types\//.test(rel))
    return 0
  if (/(^|\/)(lib|services|domain|engine|server)(\/|$)/.test(rel)) return 1
  return 2
}

function domainOf(rel) {
  const m = rel.match(/^features\/([^/]+)/)
  if (m) return m[1]
  if (rel.startsWith('shared/')) return 'shared'
  if (rel.startsWith('app/')) return 'app'
  return 'shared'
}

function kindFa(rel) {
  if (/\/components\//.test(rel) || rel.endsWith('.tsx')) return 'کامپوننت UI'
  if (/\/(config|i18n|locales)\//.test(rel) || /config\.ts$/.test(rel)) return 'تنظیمات و برچسب‌ها'
  if (/\/types/.test(rel) || /types\.ts$/.test(rel)) return 'تعاریف نوع'
  if (/\/hooks\//.test(rel)) return 'هوک'
  if (/\/services\//.test(rel)) return 'سرویس داده'
  if (/\/domain\//.test(rel) || /\/engine\//.test(rel) || /\/lib\//.test(rel)) return 'منطق دامنه'
  return 'ماژول'
}

function purposeOf(rel) {
  const domain = domainOf(rel)
  const area = DOMAIN_FA[domain] ?? domain
  const base = rel.split('/').pop().replace(/\.(ts|tsx)$/, '')
  return `${kindFa(rel)} — ${area} (${base})`
}

function safeToEdit(rel) {
  const yes =
    /(^|\/)(config|i18n|locales)(\/|$)/.test(rel) ||
    /config\.ts$/.test(rel) ||
    /\/brand\.ts$/.test(rel) ||
    (/types\.ts$/.test(rel) && !/components/.test(rel))
  return yes ? 'YES' : 'CAREFUL'
}

function dependsOn(src) {
  const found = []
  const re = /from\s+['"](@\/[^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    const p = m[1].replace(/^@\//, '').replace(/\/index$/, '')
    if (!found.includes(p)) found.push(p)
  }
  if (found.length === 0) return 'nothing'
  return found.slice(0, 10).join(', ')
}

function buildHeader(rel, src) {
  const lines = [
    '/**',
    ` * @file ${rel}`,
    ` * @purpose ${purposeOf(rel)}`,
    ` * @safe-to-edit ${safeToEdit(rel)}`,
    ` * @affects ${DOMAIN_FA[domainOf(rel)] ?? domainOf(rel)}`,
    ` * @depends-on ${dependsOn(src)}`,
    ' */',
  ]
  return lines.join('\n')
}

function insertHeader(src, header) {
  if (src.includes('@file ')) return null
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const headerNl = header.replace(/\n/g, nl)
  const directives = []
  let rest = src
  while (true) {
    const m = rest.match(/^(['"]use (?:client|server)['"];)(\r?\n)/)
    if (!m) break
    directives.push(m[1])
    rest = rest.slice(m[0].length)
  }
  while (rest.startsWith('\n') || rest.startsWith('\r\n')) {
    rest = rest.replace(/^\r?\n/, '')
  }
  const top = directives.length ? directives.join(nl) + nl + nl : ''
  return top + headerNl + nl + nl + rest
}

const files = [
  ...walk(path.join(ROOT, 'features')),
  ...walk(path.join(ROOT, 'shared')),
  ...walk(path.join(ROOT, 'app')),
].sort((a, b) => {
  const ra = posixRel(a)
  const rb = posixRel(b)
  return layerOf(ra) - layerOf(rb) || ra.localeCompare(rb)
})

let added = 0
let skipped = 0
const byLayer = [0, 0, 0]
for (const file of files) {
  const rel = posixRel(file)
  const src = fs.readFileSync(file, 'utf8')
  const next = insertHeader(src, buildHeader(rel, src))
  if (!next) {
    skipped++
    continue
  }
  fs.writeFileSync(file, next)
  added++
  byLayer[layerOf(rel)]++
}

console.log(JSON.stringify({ added, skipped, byLayer: { config: byLayer[0], lib: byLayer[1], ui: byLayer[2] } }))
