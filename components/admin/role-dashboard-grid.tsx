'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { CONSTRUCTION_ROLES } from '@/lib/admin/construction-roles'
import {
  getRoleDashboardRoute,
  memberWorkspaceHref,
  ROLE_DASHBOARD_ROUTES,
} from '@/lib/admin/role-dashboard-routes'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import { getPositionLabel } from '@/lib/i18n/position-labels'
import type { ProjectMember } from '@/types/admin'
import { cn } from '@/lib/utils'

const DUTY_FA: Record<string, string> = {
  project_manager: 'برنامه‌ریزی کلی، هماهنگی و تحویل پروژه.',
  site_manager: 'رهبری روزانه کارگاه، نیروی کار و هماهنگی میدان.',
  site_supervisor: 'نظارت بر عملیات روزانه و پیشرفت کارگاه.',
  technical_office: 'تکمیل مقادیر، تجزیه کوتاه‌مدت و پرچم آمادگی پرداخت.',
  civil_engineer: 'نظارت بر کارهای عمرانی و سازه‌ای.',
  architect: 'انطباق طراحی و هماهنگی معماری.',
  structural_engineer: 'بررسی طراحی سازه و انطباق در میدان.',
  mep_engineer: 'سیستم‌های مکانیک، برق و لوله‌کشی.',
  hse_officer: 'پایش دوربین ایمنی، بازبینی حوادث و اعلان به سرپرست و مدیر پروژه.',
  qa_qc_inspector: 'بازرسی تضمین و کنترل کیفیت.',
  surveyor: 'اندازه‌گیری، پیاده‌سازی و تأیید ازبیلت.',
  storekeeper: 'دریافت مصالح، موجودی و انبارداری.',
  procurement_officer: 'خرید، هماهنگی تأمین‌کننده و زنجیره تأمین.',
  project_accountant: 'هزینه‌ها، فاکتورها، وصول و گزارش مالی پروژه.',
  planning_engineer: 'برنامه‌زمانی، نگاه‌به‌جلو و بهره‌وری.',
  document_controller: 'نقشه‌ها، مستندات و مدیریت مدارک.',
  foreman: 'سرپرستی اکیپ‌های میدان در جبهه‌های کاری.',
  contractor: 'نماینده پیمانکار خارجی در کارگاه.',
  subcontractor: 'دسترسی میدان پیمانکار تخصصی.',
  finance_admin: 'پیگیری بودجه، فاکتورها و پشتیبانی اداری.',
  equipment_manager: 'تخصیص ماشین‌آلات و تجهیزات.',
  security: 'دسترسی گیت، ورود/خروج و امنیت کارگاه.',
  worker: 'کارگر میدان با وظایف و آموزش ایمنی.',
  visitor: 'دسترسی موقت محدود به کارگاه.',
}

/** Preferred display order for live role dashboards in the control center. */
const LIVE_ROLE_ORDER = [
  'project_manager',
  'site_supervisor',
  'hse_officer',
  'technical_office',
  'security',
  'storekeeper',
  'procurement_officer',
  'qa_qc_inspector',
  'project_accountant',
] as const

function dutySummary(positionKey: string, positionTitle: string): string {
  return (
    DUTY_FA[positionKey] ??
    CONSTRUCTION_ROLES.find((r) => r.key === positionKey)?.description ??
    positionTitle
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function roleTitleFa(key: string): string {
  return getPositionLabel({ key, title: key }, 'fa')
}

function liveRoleKeys(): string[] {
  const keys = Object.keys(ROLE_DASHBOARD_ROUTES)
  return [...keys].sort((a, b) => {
    const ia = LIVE_ROLE_ORDER.indexOf(a as (typeof LIVE_ROLE_ORDER)[number])
    const ib = LIVE_ROLE_ORDER.indexOf(b as (typeof LIVE_ROLE_ORDER)[number])
    const ra = ia === -1 ? 999 : ia
    const rb = ib === -1 ? 999 : ib
    if (ra !== rb) return ra - rb
    return roleTitleFa(a).localeCompare(roleTitleFa(b), 'fa')
  })
}

/** Role dashboards catalog + defined members checkerboard. */
export function RoleDashboardGrid({ members }: { members: ProjectMember[] }) {
  const roleKeys = liveRoleKeys()
  const memberCountByRole = new Map<string, number>()
  for (const m of members) {
    for (const p of m.positions ?? []) {
      memberCountByRole.set(p.key, (memberCountByRole.get(p.key) ?? 0) + 1)
    }
  }

  const rows = members
    .slice()
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, 'fa'))

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/hse"
        className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3.5 transition-colors hover:bg-amber-100"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-950">داشبورد مسئول ایمنی</p>
            <p className="text-xs text-amber-900/80">
              باز کردن مرکز کنترل ایمنی — حتی اگر هنوز عضوی با این نقش تعریف نشده باشد
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white">
          باز کردن
        </span>
      </Link>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">داشبوردهای نقش</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          ورود مستقیم به داشبورد عملیاتی هر نقش — شامل مسئول ایمنی.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {roleKeys.map((key) => {
            const href = getRoleDashboardRoute(key)
            if (!href) return null
            const assigned = memberCountByRole.get(key) ?? 0
            const isHse = key === 'hse_officer'
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  'flex gap-3 rounded-xl border p-3.5 transition-colors hover:bg-amber-50/70',
                  isHse
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-white'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isHse ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-200/90 text-slate-700'
                  )}
                >
                  {isHse ? <ShieldAlert className="h-4 w-4" /> : roleTitleFa(key).slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{roleTitleFa(key)}</p>
                    {isHse ? (
                      <span className="rounded border border-amber-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        ایمنی
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {dutySummary(key, roleTitleFa(key))}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {assigned > 0
                      ? `${assigned} عضو با این نقش`
                      : isHse
                        ? 'هنوز عضوی نیست — از «مدیریت اعضا» نقش مسئول ایمنی را تعریف کنید'
                        : 'هنوز عضوی با این نقش نیست — داشبورد آماده است'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">اعضای تعریف‌شده</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">با کلیک به داشبورد نقش اصلی یا پروفایل عضو می‌روید.</p>
          </div>
          <Link
            href="/admin/members"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            تعریف مسئول ایمنی
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 py-8 text-center text-sm text-muted-foreground">
            هنوز عضوی تعریف نشده است.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {rows.map((member, index) => {
                const positions = member.positions ?? []
                const primary = positions[0]
                const duty = primary
                  ? dutySummary(primary.key, getPositionLabel(primary, 'fa'))
                  : 'سمت تعریف نشده'
                const roleTitles =
                  positions.map((p) => getPositionLabel(p, 'fa')).join(' · ') || '—'
                const href = memberWorkspaceHref(member)
                const row = Math.floor(index / 2)
                const col = index % 2
                const dark = (row + col) % 2 === 1

                return (
                  <Link
                    key={member.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => writeProjectCookie(member.project_id)}
                    className={cn(
                      'flex gap-3 border-b border-e border-slate-200 p-4 transition-colors hover:bg-amber-50/70',
                      dark ? 'bg-slate-100' : 'bg-white',
                      !member.is_active && 'opacity-55'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        dark ? 'bg-white text-slate-700' : 'bg-slate-200/90 text-slate-700'
                      )}
                    >
                      {initials(member.full_name || member.email || '?')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {member.full_name || member.email}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-600">{roleTitles}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {duty}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
