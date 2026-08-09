'use client'

import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function ProjectToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  location,
  onLocationChange,
  locations,
  sort,
  onSortChange,
  onRefresh,
  refreshing,
}: {
  query: string
  onQueryChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  location: string
  onLocationChange: (v: string) => void
  locations: string[]
  sort: string
  onSortChange: (v: string) => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  const selectClass =
    'h-9 rounded-lg border border-[#E4E7EC] bg-white px-2.5 text-sm text-[#17202A] outline-none focus:ring-2 focus:ring-[#C96A1B]/30'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] bg-white p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="جستجوی پروژه…"
          className="h-9 border-[#E4E7EC] ps-9"
          aria-label="جستجوی پروژه"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={cn(selectClass, 'min-w-[140px]')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="فیلتر وضعیت"
        >
          <option value="all">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="planning">برنامه‌ریزی</option>
          <option value="at_risk">در خطر</option>
          <option value="completed">تکمیل‌شده</option>
          <option value="suspended">متوقف</option>
          <option value="paused">متوقف موقت</option>
        </select>

        {locations.length > 0 ? (
          <select
            className={cn(selectClass, 'min-w-[140px]')}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            aria-label="فیلتر محل"
          >
            <option value="all">همه محل‌ها</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        ) : null}

        <select
          className={cn(selectClass, 'min-w-[140px]')}
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="مرتب‌سازی"
        >
          <option value="updated_desc">جدیدترین به‌روزرسانی</option>
          <option value="name_asc">نام (الف تا ی)</option>
          <option value="name_desc">نام (ی تا الف)</option>
          <option value="progress_desc">بیشترین پیشرفت</option>
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-[#E4E7EC]"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="تازه‌سازی فهرست پروژه‌ها"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          تازه‌سازی
        </Button>
      </div>
    </div>
  )
}
