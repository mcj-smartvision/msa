'use client'

import Link from 'next/link'
import { Building2, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  estimateProgress,
  PROJECT_STATUS_LABEL,
  resolveProjectStatusKey,
} from '@/lib/admin/project-status'
import type { AdminProject } from '@/types/admin'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-[#EAF6F0] text-[#2E8B68] border-[#2E8B68]/25',
  planning: 'bg-[#EDF4F8] text-[#4D718A] border-[#4D718A]/25',
  at_risk: 'bg-[#FFF6DF] text-[#C58B20] border-[#C58B20]/30',
  completed: 'bg-slate-100 text-slate-700 border-slate-300',
  suspended: 'bg-[#FDECEC] text-[#C94B4B] border-[#C94B4B]/25',
  paused: 'bg-[#FDECEC] text-[#C94B4B] border-[#C94B4B]/25',
}

function formatRelative(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'همین الان'
  if (mins < 60) return `${mins} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ساعت پیش`
  const days = Math.floor(hours / 24)
  return `${days} روز پیش`
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

export function ProjectRow({ project }: { project: AdminProject }) {
  const progress = estimateProgress(project.status, project.is_active)
  const href = `/admin/projects/${project.id}/members`
  const updated = project.updated_at || project.created_at

  return (
    <article className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-3 shadow-sm transition-colors hover:border-[#C96A1B]/35 hover:bg-[#FFFCF8] focus-within:ring-2 focus-within:ring-[#C96A1B]/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#17202A]">{project.name}</h3>
            <ProjectStatusBadge status={project.status} isActive={project.is_active} />
          </div>
          <p className="truncate text-xs text-[#667085]">
            {[project.code, project.location || 'محل نامشخص'].filter(Boolean).join(' · ')}
          </p>
          <div className="max-w-md space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[#667085]">
              <span>پیشرفت</span>
              <span className="font-semibold tabular-nums text-[#17202A]">{progress}٪</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[#E4E7EC]">
              <div
                className="h-full rounded bg-[#4D718A]"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#667085]">آخرین به‌روزرسانی: {formatRelative(updated)}</p>
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
        اولین پروژه را بسازید تا پایش فعالیت‌های عمرانی، اعضا و پیشرفت آغاز شود.
      </p>
      <Button type="button" className="mt-5 bg-[#C96A1B] hover:bg-[#A95312]" onClick={onCreate}>
        <Building2 className="h-4 w-4" />
        ایجاد پروژه
      </Button>
    </div>
  )
}
