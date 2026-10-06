'use client'

import Link from 'next/link'
import { Building2, FolderKanban, Users } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { PROJECT_STATUS_LABEL, resolveProjectStatusKey } from '@/features/admin/lib/project-status'
import type { AdminProject } from '@/shared/types/admin'
import { APP_NAME } from '@/shared/lib/brand'
import { cn } from '@/shared/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-[#EAF6F0] text-[#2E8B68] border-[#2E8B68]/25',
  planning: 'bg-[#EDF4F8] text-[#4D718A] border-[#4D718A]/25',
  at_risk: 'bg-[#FFF6DF] text-[#C58B20] border-[#C58B20]/30',
  completed: 'bg-slate-100 text-slate-700 border-slate-300',
  suspended: 'bg-[#FDECEC] text-[#C94B4B] border-[#C94B4B]/25',
  paused: 'bg-[#FDECEC] text-[#C94B4B] border-[#C94B4B]/25',
}

export function ProjectStatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  const key = resolveProjectStatusKey(status, isActive)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold',
        STATUS_STYLE[key] ?? STATUS_STYLE.planning
      )}
    >
      {PROJECT_STATUS_LABEL[key] ?? status}
    </span>
  )
}

function formatCreated(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleDateString('fa-IR')
}

export function ProjectRow({
  project,
  memberCount,
  ownerLabel,
  index,
}: {
  project: AdminProject
  memberCount: number
  ownerLabel?: string | null
  index?: number
}) {
  const href = `/admin/projects/${project.id}/members`
  const org = ownerLabel?.trim() || APP_NAME
  const enabled = project.is_active

  return (
    <article className="rounded-lg border border-[#5a7088] bg-white px-3 py-3 shadow-sm transition-colors hover:border-[#C96A1B]/35 hover:bg-[#FFFCF8] focus-within:ring-2 focus-within:ring-[#C96A1B]/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {index != null ? (
              <span className="text-xs tabular-nums text-slate-400">{index}</span>
            ) : null}
            <h3 className="truncate text-sm font-semibold text-[#17202A]">{project.name}</h3>
            <span
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                enabled
                  ? 'border-[#2E8B68]/25 bg-[#EAF6F0] text-[#2E8B68]'
                  : 'border-slate-300 bg-slate-100 text-slate-600'
              )}
            >
              {enabled ? 'فعال در سامانه' : 'غیرفعال'}
            </span>
          </div>
          <p className="truncate text-xs text-[#667085]">
            سازمان / مالک: {org}
            {project.code ? ` · ${project.code}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#344054]">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-[#667085]" />
              {memberCount} عضو
            </span>
            <span>ایجاد: {formatCreated(project.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" className="bg-[#C96A1B] hover:bg-[#A95312]">
            <Link href={href}>باز کردن</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

export function EmptyProjectsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[#E4E7EC] bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#EDF4F8] text-[#4D718A]">
        <FolderKanban className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-[#17202A]">هنوز پروژه‌ای نیست</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#667085]">
        اولین پروژه را بسازید تا اعضا، دسترسی‌ها و تنظیمات سامانه را از اینجا مدیریت کنید.
      </p>
      <Button type="button" className="mt-5 bg-[#C96A1B] hover:bg-[#A95312]" onClick={onCreate}>
        <Building2 className="h-4 w-4" />
        ایجاد پروژه
      </Button>
    </div>
  )
}
