import { z } from 'zod'
import type { CrePhase1Export } from './types'

const fieldStateSchema = z.object({
  value: z.unknown(),
  state: z.string(),
  note: z.string().optional(),
})

const tableStatsSchema = z.object({
  total_rows: z.number(),
  ready_rows: z.number(),
  partial_rows: z.number().optional(),
  not_ready_rows: z.number(),
})

const controlReadyRowSchema = z.object({
  task_uid: z.number(),
  task_id: z.number().optional(),
  wbs: z.string().optional(),
  name: z.string(),
  is_summary: z.boolean(),
  location: fieldStateSchema,
  quantity: fieldStateSchema,
  quantity_uom: fieldStateSchema,
  crew_or_resource: fieldStateSchema,
  person_day: fieldStateSchema,
  progress_method: fieldStateSchema,
  start: fieldStateSchema,
  finish: fieldStateSchema,
  percent_complete: fieldStateSchema.optional(),
  readiness_row_status: z.enum(['READY', 'PARTIAL', 'NOT_READY']),
  blockers: z.array(z.string()).optional(),
})

export const crePhase1ExportSchema = z.object({
  ok: z.boolean(),
  policy_version: z.string(),
  project_context: z.object({
    evaluation_date: z.string(),
    unit_system: z.enum(['metric', 'imperial']),
    language_ui: z.enum(['en', 'fa']),
  }),
  summary: z.object({
    gate: z.enum(['CONTROL_READY', 'NOT_CONTROL_READY']),
    overall_score: z.number(),
    blocker_count: z.number(),
    finding_codes: z.array(z.string()),
    truth_flags: z.record(z.boolean()),
    stats: z.record(z.number()),
    top_remediations: z.array(z.string()),
    table: tableStatsSchema,
    forecast: z.string(),
  }),
  findings: z.array(
    z.object({
      code: z.string(),
      severity: z.string().optional(),
      title: z.string().optional(),
      evidence: z.unknown().optional(),
      remediation: z.union([z.string(), z.array(z.string())]).optional(),
    })
  ),
  control_ready_table: tableStatsSchema.extend({
    rows: z.array(controlReadyRowSchema),
  }),
})

export function parseCrePhase1Export(input: unknown): CrePhase1Export {
  return crePhase1ExportSchema.parse(input) as CrePhase1Export
}

export function safeParseCrePhase1Export(input: unknown) {
  return crePhase1ExportSchema.safeParse(input)
}
