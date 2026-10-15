'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { readProjectDailyProgress, upsertDailyEntries, writeProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { deleteDailyProgress, postDailyProgress } from '@/features/supervisor/lib/daily-progress-sync'
import {
checkPercentEntry,
cumulativeBefore,
cumulativeEntry,
entryOn,
latestReport,
mergeProgressHistory,
withLatestReports,
withoutDay,
} from '@/features/supervisor/lib/weekly-activity-progress'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import {
deriveContext,
deriveEvmIndices,
deriveTasks,
weekOfAll,
weeklyPpcOf,
type DeriveContext,
type EvmIndices,
} from './lib/derive'
import { applyDrafts, draftKey, parseDraftKey, type ProgressDrafts } from './lib/drafts'
import { exportStoreToCSV, exportStoreToJSON, type StoreExport } from './lib/export'
import type { TaskItem } from './lib/schema'
import type { ProjectSnapshot } from './lib/snapshot-types'
import { addDays, isEvaluationOpen, round2, type ActivityWeek, type WeekPpc } from './lib/weekly-engine'

export type ProjectStoreStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ProjectStoreState {
  projectId: string | null
  status: ProjectStoreStatus
  error: string | null
  snapshot: ProjectSnapshot | null
  /** Daily-report entries kept in this browser (offline copies of saved reports). */
  localEntries: DailyProgressEntry[]
  /** Unsaved progress edits per project; survives a reload. */
  draftsByProject: Record<string, ProgressDrafts>
  nowMs: number
  today: string
  syncing: boolean
  lastSyncedAt: string | null

  /** Saved history with this project's drafts applied: what every view shows. */
  entries: DailyProgressEntry[]
  tasks: Record<string, TaskItem>
  taskOrder: string[]
  weekStart: string | null

  loadProject: (projectId: string | null, options?: { force?: boolean }) => Promise<void>
  /** Reloads the snapshot; with `ifOlderThanMs`, only when the current one is older (and not loading). */
  refresh: (options?: { ifOlderThanMs?: number }) => Promise<void>
  /** Re-reads the browser's offline copies of daily reports (saved by views not yet on the store). */
  reloadLocalEntries: () => void
  tick: (nowMs?: number) => void
  /** The only way progress changes: sets an activity's cumulative percent on a day (today by default). */
  updateTaskProgress: (taskId: string, newProgress: number, dateKey?: string) => void
  /** Records a day's gain; stored as that day's cumulative (gain + cumulative before the day). */
  logDailyProgress: (taskId: string, dateKey: string, dailyValue: number) => void
  removeDailyLog: (taskId: string, dateKey: string) => void
  /** Restores the saved value of one draft cell. */
  revertDraft: (taskId: string, dateKey: string) => void
  discardDrafts: () => void
  /** Saves the drafts (delete + post, oldest first) and reloads the snapshot. */
  syncWithDatabase: () => Promise<{ saved: number }>
  /**
   * Saves cumulative percents right away (the daily report form): this browser's copy first, then the
   * database, then reloads. Drafts on the same cells are dropped. `notesByDate` replaces the stored notes.
   */
  saveDailyReports: (
    reports: Array<{ taskId: string; dateKey: string; progress: number }>,
    options?: { notesByDate?: Record<string, string> }
  ) => Promise<void>
  /** Root cause of a missed commitment; the week defaults to the latest week open for evaluation. */
  setWeeklyEvaluation: (taskId: string, rncReason: string, options?: { note?: string; weekStart?: string }) => Promise<void>

  getTaskById: (taskId: string) => TaskItem | undefined
  getProgressById: (taskId: string) => number | null
  getWeeklyPPC: () => WeekPpc | null
  getEVMIndices: () => EvmIndices | null
  getWeekEvaluation: (weekStart: string) => Map<string, ActivityWeek>
  getDrafts: () => ProgressDrafts
  getSavedCumulative: (taskId: string, dateKey: string) => number | null
  exportSnapshot: () => StoreExport
  exportJSON: () => string
  exportCSV: () => string
}

type Derived = Pick<ProjectStoreState, 'entries' | 'tasks' | 'taskOrder' | 'weekStart'>
type Persisted = Pick<ProjectStoreState, 'draftsByProject'>

const EMPTY_DRAFTS: ProgressDrafts = {}

const contextCache = new WeakMap<ProjectSnapshot, DeriveContext>()
function contextOf(snapshot: ProjectSnapshot): DeriveContext {
  let ctx = contextCache.get(snapshot)
  if (!ctx) {
    ctx = deriveContext(snapshot)
    contextCache.set(snapshot, ctx)
  }
  return ctx
}

const evmCache = new WeakMap<Record<string, TaskItem>, EvmIndices | null>()

function savedHistory(state: Pick<ProjectStoreState, 'snapshot' | 'localEntries'>): DailyProgressEntry[] {
  return state.snapshot ? mergeProgressHistory(state.snapshot.history, state.localEntries) : []
}

function derive(state: ProjectStoreState): Derived {
  const { snapshot, projectId } = state
  if (!snapshot || snapshot.projectId !== projectId) return { entries: [], tasks: {}, taskOrder: [], weekStart: null }
  const drafts = state.draftsByProject[snapshot.projectId] ?? EMPTY_DRAFTS
  const { preview } = applyDrafts(savedHistory(state), drafts)
  const unsyncedIds = new Set(Object.keys(drafts).map((k) => parseDraftKey(k).activityId))
  const { order, byId, weekStart } = deriveTasks({
    snapshot,
    ctx: contextOf(snapshot),
    entries: preview,
    unsyncedIds,
    today: state.today,
    nowMs: state.nowMs,
  })
  return { entries: preview, tasks: byId, taskOrder: order, weekStart }
}

async function fetchSnapshot(projectId: string): Promise<ProjectSnapshot> {
  const res = await fetch(`/api/project-store/snapshot?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as ProjectSnapshot & { error?: string }
  if (!res.ok) throw new Error(data.error || 'بارگذاری دادهٔ پروژه ناموفق بود')
  return data
}

let loadSeq = 0

export const useProjectStore = create<ProjectStoreState>()(
  devtools(
    persist(
      (set, get) => {
        /** Applies a change and recomputes the derived task table in the same update. */
        const commit = (partial: Partial<ProjectStoreState>, action: string) => {
          const next = { ...get(), ...partial }
          set({ ...partial, ...derive(next) }, false, action)
        }

        const setDrafts = (update: (drafts: ProgressDrafts) => ProgressDrafts, action: string) => {
          const { projectId, draftsByProject } = get()
          if (!projectId) return
          const nextDrafts = update({ ...(draftsByProject[projectId] ?? EMPTY_DRAFTS) })
          const nextByProject = { ...draftsByProject }
          if (Object.keys(nextDrafts).length === 0) delete nextByProject[projectId]
          else nextByProject[projectId] = nextDrafts
          commit({ draftsByProject: nextByProject }, action)
        }

        const setCell = (taskId: string, dateKey: string, value: number | null, action: string) => {
          if (value != null && checkPercentEntry(value, null).error != null) throw new Error('درصد پیشرفت باید بین 0 و 100 باشد')
          const saved = get().getSavedCumulative(taskId, dateKey)
          const normalized = value == null ? null : round2(value)
          setDrafts((drafts) => {
            const key = draftKey(taskId, dateKey)
            if (normalized === saved) delete drafts[key]
            else drafts[key] = normalized
            return drafts
          }, action)
        }

        return {
          projectId: null,
          status: 'idle',
          error: null,
          snapshot: null,
          localEntries: [],
          draftsByProject: {},
          nowMs: Date.now(),
          today: todayTehranIso(),
          syncing: false,
          lastSyncedAt: null,
          entries: [],
          tasks: {},
          taskOrder: [],
          weekStart: null,

          loadProject: async (projectId, options) => {
            const state = get()
            if (!projectId) {
              commit({ projectId: null, snapshot: null, status: 'idle', error: null, localEntries: [] }, 'project/clear')
              return
            }
            if (!options?.force && state.projectId === projectId && (state.status === 'ready' || state.status === 'loading')) return
            const seq = ++loadSeq
            const switching = state.projectId !== projectId
            commit(
              {
                projectId,
                status: 'loading',
                error: null,
                ...(switching ? { snapshot: null, localEntries: [] } : {}),
              },
              'project/load'
            )
            try {
              const snapshot = await fetchSnapshot(projectId)
              if (seq !== loadSeq) return
              const nowMs = Date.now()
              commit(
                {
                  snapshot,
                  localEntries: readProjectDailyProgress(projectId).entries,
                  status: 'ready',
                  nowMs,
                  today: todayTehranIso(nowMs),
                },
                'project/loaded'
              )
            } catch (e) {
              if (seq !== loadSeq) return
              commit({ status: 'error', error: e instanceof Error ? e.message : 'بارگذاری ناموفق بود' }, 'project/error')
            }
          },

          refresh: async (options) => {
            const { projectId, status, snapshot } = get()
            if (!projectId) return
            if (options?.ifOlderThanMs != null) {
              if (status === 'loading') return
              const age = snapshot ? Date.now() - Date.parse(snapshot.generatedAt) : Infinity
              if (age < options.ifOlderThanMs) return
            }
            await get().loadProject(projectId, { force: true })
          },

          reloadLocalEntries: () => {
            const { projectId } = get()
            if (projectId) commit({ localEntries: readProjectDailyProgress(projectId).entries }, 'local/reload')
          },

          tick: (nowMs = Date.now()) => {
            const today = todayTehranIso(nowMs)
            const state = get()
            const minuteChanged = Math.floor(nowMs / 60_000) !== Math.floor(state.nowMs / 60_000)
            if (!minuteChanged && today === state.today) return
            commit({ nowMs, today }, 'clock/tick')
          },

          updateTaskProgress: (taskId, newProgress, dateKey) => {
            setCell(taskId, dateKey ?? get().today, newProgress, 'progress/update')
          },

          logDailyProgress: (taskId, dateKey, dailyValue) => {
            const state = get()
            const baseline = state.snapshot ? contextOf(state.snapshot).activities.find((a) => a.id === taskId)?.baselinePercentComplete ?? 0 : 0
            const before = cumulativeBefore(taskId, state.entries, dateKey, baseline) ?? 0
            setCell(taskId, dateKey, Math.min(100, round2(before + dailyValue)), 'progress/logDaily')
          },

          removeDailyLog: (taskId, dateKey) => {
            const saved = get().getSavedCumulative(taskId, dateKey)
            setDrafts((drafts) => {
              const key = draftKey(taskId, dateKey)
              if (saved == null) delete drafts[key]
              else drafts[key] = null
              return drafts
            }, 'progress/removeDaily')
          },

          revertDraft: (taskId, dateKey) => {
            setDrafts((drafts) => {
              delete drafts[draftKey(taskId, dateKey)]
              return drafts
            }, 'progress/revert')
          },

          discardDrafts: () => setDrafts(() => ({}), 'progress/discard'),

          syncWithDatabase: async () => {
            const state = get()
            const { projectId } = state
            const drafts = projectId ? state.draftsByProject[projectId] ?? EMPTY_DRAFTS : EMPTY_DRAFTS
            const count = Object.keys(drafts).length
            if (!projectId || state.syncing || count === 0) return { saved: 0 }
            set({ syncing: true, error: null }, false, 'sync/start')
            try {
              const { preview, changed, removed } = applyDrafts(savedHistory(state), drafts)
              const stored = readProjectDailyProgress(projectId)
              let nextLocal = stored.entries
              for (const r of removed) nextLocal = withoutDay(r.activityId, nextLocal, r.reportDate)
              nextLocal = upsertDailyEntries(nextLocal, changed)
              writeProjectDailyProgress(projectId, { ...stored, entries: nextLocal })
              window.dispatchEvent(new CustomEvent('sitepilot-daily-progress-updated', { detail: { projectId } }))

              await deleteDailyProgress(projectId, removed)
              const toPost = withLatestReports(changed, preview)
              for (const activityId of new Set(removed.map((r) => r.activityId))) {
                const latest = latestReport(activityId, preview)
                if (latest && !toPost.some((e) => e.activityId === activityId && e.reportDate === latest.reportDate)) {
                  toPost.push({ ...latest, activityId })
                }
              }
              await postDailyProgress(projectId, toPost, toPost.map((r) => r.reportDate))

              const nextByProject = { ...get().draftsByProject }
              delete nextByProject[projectId]
              commit({ draftsByProject: nextByProject, localEntries: nextLocal, lastSyncedAt: new Date().toISOString() }, 'sync/saved')
              await get().loadProject(projectId, { force: true })
              return { saved: count }
            } catch (e) {
              set({ error: e instanceof Error ? e.message : 'ذخیره ناموفق بود' }, false, 'sync/error')
              throw e
            } finally {
              set({ syncing: false }, false, 'sync/end')
            }
          },

          saveDailyReports: async (reports, options) => {
            const state = get()
            const { projectId } = state
            if (!projectId) return
            for (const r of reports) {
              if (checkPercentEntry(r.progress, null).error != null) throw new Error('درصد پیشرفت باید بین 0 و 100 باشد')
            }
            set({ syncing: true, error: null }, false, 'report/start')
            try {
              const saved = savedHistory(state)
              const changed = reports.map((r) => cumulativeEntry(r.taskId, saved, r.dateKey, round2(r.progress)))
              const stored = readProjectDailyProgress(projectId)
              const nextLocal = upsertDailyEntries(stored.entries, changed)
              writeProjectDailyProgress(projectId, { entries: nextLocal, notesByDate: options?.notesByDate ?? stored.notesByDate })
              window.dispatchEvent(new CustomEvent('sitepilot-daily-progress-updated', { detail: { projectId } }))

              const nextByProject = { ...get().draftsByProject }
              const drafts = { ...(nextByProject[projectId] ?? EMPTY_DRAFTS) }
              for (const e of changed) delete drafts[draftKey(e.activityId, e.reportDate)]
              if (Object.keys(drafts).length === 0) delete nextByProject[projectId]
              else nextByProject[projectId] = drafts
              commit({ localEntries: nextLocal, draftsByProject: nextByProject }, 'report/savedLocal')

              const toPost = withLatestReports(changed, upsertDailyEntries(saved, changed))
              if (toPost.length > 0) await postDailyProgress(projectId, toPost, toPost.map((r) => r.reportDate))
              commit({ lastSyncedAt: new Date().toISOString() }, 'report/saved')
              await get().loadProject(projectId, { force: true })
            } catch (e) {
              set({ error: e instanceof Error ? e.message : 'ذخیره پیشرفت در برنامه زمانبندی ناموفق بود' }, false, 'report/error')
              throw e
            } finally {
              set({ syncing: false }, false, 'report/end')
            }
          },

          setWeeklyEvaluation: async (taskId, rncReason, options) => {
            const { projectId, weekStart, nowMs } = get()
            if (!projectId || !weekStart) throw new Error('پروژه بارگذاری نشده است')
            const week = options?.weekStart ?? evaluationWeekStart(weekStart, nowMs)
            const res = await fetch('/api/project-store/rnc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId, activityId: taskId, weekStart: week, category: rncReason, note: options?.note ?? null }),
            })
            const data = (await res.json().catch(() => ({}))) as { error?: string }
            if (!res.ok) throw new Error(data.error || 'ثبت علت عدم تحقق ناموفق بود')
            await get().refresh()
          },

          getTaskById: (taskId) => get().tasks[taskId],
          getProgressById: (taskId) => get().tasks[taskId]?.actual_progress ?? null,
          getWeeklyPPC: () => {
            const { tasks, weekStart, nowMs } = get()
            return weekStart ? weeklyPpcOf(tasks, weekStart, nowMs) : null
          },
          getEVMIndices: () => {
            const { snapshot, tasks, today } = get()
            if (!snapshot) return null
            if (!evmCache.has(tasks)) evmCache.set(tasks, deriveEvmIndices(snapshot, tasks, today))
            return evmCache.get(tasks) ?? null
          },
          getWeekEvaluation: (week) => {
            const { snapshot, entries, today, nowMs } = get()
            if (!snapshot) return new Map()
            return weekOfAll({ ctx: contextOf(snapshot), entries, weekStart: week, today, nowMs })
          },
          getDrafts: () => {
            const { projectId, draftsByProject } = get()
            return projectId ? draftsByProject[projectId] ?? EMPTY_DRAFTS : EMPTY_DRAFTS
          },
          getSavedCumulative: (taskId, dateKey) => entryOn(taskId, savedHistory(get()), dateKey)?.percentComplete ?? null,
          exportSnapshot: () => {
            const state = get()
            const evm = state.getEVMIndices()
            return {
              projectId: state.projectId,
              exportedAt: new Date().toISOString(),
              today: state.today,
              weekStart: state.weekStart,
              weeklyPpc: state.getWeeklyPPC(),
              evm: evm ? (({ cost: _c, ...rest }) => rest)(evm) : null,
              tasks: state.taskOrder.map((id) => state.tasks[id]!),
            }
          },
          exportJSON: () => exportStoreToJSON(get().exportSnapshot()),
          exportCSV: () => {
            const state = get()
            return exportStoreToCSV(state.taskOrder.map((id) => state.tasks[id]!))
          },
        }
      },
      {
        name: 'msa-project-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state): Persisted => ({ draftsByProject: state.draftsByProject }),
        skipHydration: true,
      }
    ),
    { name: 'MSA Project Store', enabled: process.env.NODE_ENV !== 'production' }
  )
)

/** The week whose commitments can be evaluated now: this week from Thursday 16:00, else last week. */
export function evaluationWeekStart(weekStart: string, nowMs: number): string {
  return isEvaluationOpen(weekStart, nowMs) ? weekStart : addDays(weekStart, -7)
}

type StoreReadOptions = {
  /** Null while this browser has unsaved drafts, so shared views only show saved progress. */
  savedOnly?: boolean
}

function isReady(s: ProjectStoreState, projectId: string | null, options?: StoreReadOptions): boolean {
  if (!projectId || s.projectId !== projectId || s.snapshot?.projectId !== projectId) return false
  return !(options?.savedOnly && s.draftsByProject[projectId])
}

/** EVM indices of `projectId` from the store; null until its snapshot is loaded or without cost access. */
export function useStoreEvm(projectId: string | null, options?: StoreReadOptions): EvmIndices | null {
  return useProjectStore((s) => (isReady(s, projectId, options) ? s.getEVMIndices() : null))
}

/** This week's PPC of `projectId` from the store. */
export function useStoreWeeklyPpc(
  projectId: string | null,
  options?: StoreReadOptions
): { ppc: WeekPpc; tasks: Record<string, TaskItem> } | null {
  const ready = useProjectStore((s) => isReady(s, projectId, options))
  const tasks = useProjectStore((s) => s.tasks)
  const weekStart = useProjectStore((s) => s.weekStart)
  const nowMs = useProjectStore((s) => s.nowMs)
  return useMemo(
    () => (ready && weekStart ? { ppc: weeklyPpcOf(tasks, weekStart, nowMs), tasks } : null),
    [ready, tasks, weekStart, nowMs]
  )
}

/** Recomputes the derived tables (after persisted drafts are restored). */
export function recomputeProjectStore() {
  const state = useProjectStore.getState()
  useProjectStore.setState(derive(state), false)
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { store?: typeof useProjectStore }).store = useProjectStore
}
