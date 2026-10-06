import type { LucideIcon } from 'lucide-react'
import {
Activity,
AlertTriangle,
Bell,
BookOpen,
Camera,
ClipboardList,
FileBarChart,
LayoutDashboard,
MapPinned,
Radio,
Settings,
ShieldAlert,
} from 'lucide-react'

export type HseNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

export const HSE_BASE = '/dashboard/hse'

export const HSE_NAV: HseNavItem[] = [
  { href: HSE_BASE, label: 'نمای کلی', icon: LayoutDashboard, exact: true },
  { href: `${HSE_BASE}/live`, label: 'عملیات زنده', icon: Radio },
  { href: `${HSE_BASE}/incidents`, label: 'حوادث', icon: ShieldAlert },
  { href: `${HSE_BASE}/cameras`, label: 'دوربین‌ها', icon: Camera },
  { href: `${HSE_BASE}/zones`, label: 'زون‌ها', icon: MapPinned },
  { href: `${HSE_BASE}/rules`, label: 'قوانین', icon: ClipboardList },
  { href: `${HSE_BASE}/alerts`, label: 'هشدارها', icon: Bell },
  { href: `${HSE_BASE}/reports`, label: 'گزارش‌ها', icon: FileBarChart },
  { href: `${HSE_BASE}/documentation`, label: 'راهنما', icon: BookOpen },
  { href: `${HSE_BASE}/settings`, label: 'تنظیمات', icon: Settings },
]

export const HSE_ARCHITECTURE_PILLARS = [
  { key: 'edge', label: 'لایه بینایی لبه‌ای', hint: 'استنتاج در محل کارگاه' },
  { key: 'rules', label: 'موتور قوانین', hint: 'آستانه و دوره خنک‌سازی' },
  { key: 'evidence', label: 'بسته شواهد', hint: 'فریم و کلیپ کوتاه' },
  { key: 'ai', label: 'تأیید هوش مصنوعی', hint: 'فقط موارد منتخب' },
  { key: 'review', label: 'بازبینی انسانی', hint: 'گردش‌کار ناظر' },
  { key: 'analytics', label: 'تحلیل‌ها', hint: 'شاخص و روند' },
] as const

export function isHseNavActive(pathname: string, item: HseNavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export { Activity, AlertTriangle }
