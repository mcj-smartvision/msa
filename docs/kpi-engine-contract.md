# KPI engine contract (Explainable Engine)

Every KPI in Liparta / SitePilot is produced and rendered under this contract. The code that enforces it:

| Part | File |
| --- | --- |
| Types (`ExplainedKpi`, `ControlsSnapshot`, `SnapshotField`) | `types/project-controls.ts` |
| The only KPI constructor, `buildExplainedMetric` | `lib/project-controls/explained-metric.ts` |
| Raw-data snapshot, `buildControlsSnapshot` | `lib/project-controls/controls-snapshot.ts` |
| KPI definitions | `lib/project-controls/kpis.ts` |
| Pure formulas (engines) | `lib/project-controls/earned-schedule.ts`, `tcpi-ppc.ts`, `pv-curve.ts` |
| Server entry point (EVM + WWP → snapshot → all KPIs) | `lib/project-controls/load-controls.ts`, `GET /api/manager/controls` |
| PPC source reader (latest CLOSED WWP week) | `lib/project-controls/load-weekly-plan.ts`, `database/100-weekly-work-plans.sql` |
| Absolute package weights + weight validation | `lib/schedule/weight-consistency.ts` |
| Contract tests | `tests/project-controls/explained-metric.test.ts`, `tests/schedule/weight-consistency.test.ts` |

Data comes from Supabase. The repo does not use Prisma or Drizzle.

## Mandatory rules

1. **No fake or placeholder data.** A KPI never renders from a default, a zero standing in for "not recorded", or an invented number. If an input is unavailable, the KPI comes back with `value: null`, `status: 'gray'`, `data_quality: 'missing'` (or `'invalid'`) and a Persian `reason_fa` explaining why. Example: AC = 0 means "cost not recorded", so TCPI is **missing**, not "healthy".
2. **One constructor.** KPIs are built only through `buildExplainedMetric(spec)`. It checks the inputs *before* calling `compute`, so a formula never sees missing data.
3. **One input model.** KPIs read their inputs only from `ControlsSnapshot`, never directly from the database or API responses.
4. **The UI renders only `ExplainedKpi`.** It shows the value only when `data_quality` is `ok` or `stale`. Otherwise it shows the data-quality label and `reason_fa`.

## Output fields (`ExplainedKpi<T>`)

| Field | Meaning |
| --- | --- |
| `key` | Stable identifier (`spi_t`, `tcpi_bac`, …) |
| `title_fa` | Persian title |
| `value` | Number, or `null` when not computable |
| `unit` | Display unit (ضریب، روز، ماه، درصد …) |
| `formula` | The formula as text |
| `substitution` | The formula with the real numbers substituted |
| `interpretation_fa` | Persian management interpretation |
| `status` | `green` \| `yellow` \| `red` \| `gray` |
| `data_quality` | `ok` \| `missing` \| `stale` \| `invalid` |
| `evidence` | `{ sources: string[], asOf: ISODate }`: the unique input sources and the oldest input date |
| optional | `code` (KPI-04…), `reason_fa`, `actionable_decision_fa`, `assumptions`, `debug` |

## Status and data quality

- `gray` means "no judgement": the data is unusable, or the KPI has no threshold.
- `missing` means an input does not exist (for example, no AC recorded or no WWP).
- `invalid` means an input exists but is out of domain (BAC ≤ 0, status date before start, completed > planned), the compute function threw, or the result is not finite.
- `stale` means the inputs are older than `staleAfterDays` (default 7). The value is still shown, flagged as old.
- If any input is missing or invalid, the KPI is not computed.

## `ControlsSnapshot`

Each field is a `SnapshotField<T> = { value, quality, source, asOf, reason_fa? }`.

| Field | Source | Missing / invalid when |
| --- | --- | --- |
| `bac` | contract amount or project budget | no budget basis (missing), ≤ 0 (invalid) |
| `progressBasis` | `schedule_weight` when any leaf has an MSP weight, otherwise `budget` | — |
| `pv`, `ev` | `project_tasks` + `workshop_packages` (baseline, physical %): **percent of project**, Σ wᵢ·pᵢ ÷ Σ wᵢ on `progressBasis` | no weighted leaf activities |
| `evCost` (TCPI input) | Σ budgetᵢ × physicalᵢ, in money | no budget basis (inherits `bac`) |
| `ac` | recorded actual costs | AC ≤ 0, meaning not recorded |
| `pvCurve`, `projectStart`, `baselineFinish`, `plannedDuration` | baseline PV curve on `progressBasis`, scaled to end at 100 | no activities with baseline dates |
| `actualTime` (AT), `earnedSchedule` (ES) | derived from the curve | status date ≤ baseline start (AT invalid) |
| `weeklyPlan` (PPC input) | latest CLOSED week of `weekly_work_plans` / `wwp_commitments` (view `wwp_weekly_ppc`) | tables not installed; no closed week; 0 committed items; inconsistent counts. Stale when the week ended more than 7 + `staleAfterDays` days ago |
| `weightIssues` | weight validation of the EVM loader | — (data-quality log; never blocks) |

Conventions: calendar days, Asia/Tehran dates, and frozen-baseline PV.

### Progress basis (stage پ)

- SPI, PV%, EV%, the S-curve and «پیشرفت تجمعی» all use the normalized schedule weight: SPI = EV% ÷ PV%. Budgets are used only for cost: EV_cost = Σ budget × %, CV, CPI (only when AC > 0 and the budget is real) and TCPI.
- This intentionally changed SPI from the budget basis (Noor 2026-10-03: 0.847 → 0.7405). `tests/manager/noor-golden.test.ts` pins the hand-derived values for PV, EV, SPI, ES, SPI(t), SV(t), EAC(t), the delay, TCPI and PPC.
- The dashboard forecast (`scheduleForecast`) runs the same engine in calendar days: lag = AT − ES, optimistic finish = baseline finish + lag, trend finish = today + (PD − ES) ÷ SPI(t), and `planPeriodEnded`.

### Weights

- Package weights are **absolute**: the same units as the parent activity, and the children of one parent must sum to the parent's weight. An unweighted package shares what its weighted siblings leave.
- A package's PV uses its parent MSP activity's baseline, not the package's own dates.
- If a sibling group does not sum to its parent, or the leaf total is not 100, the weights are scaled to fit, a `[data-quality]` warning is logged, and the issue appears in `weightIssues`. The calculation always continues.

## Current KPIs

| key | Formula | Thresholds (green / yellow / red) |
| --- | --- | --- |
| `at` | (status − start) ÷ daysPerUnit | — (gray) |
| `es` | C + (EV − PV_C) ÷ (PV_C+1 − PV_C) | — (gray) |
| `spi_t` | ES ÷ AT | ≥ 0.98 / ≥ 0.90 / < 0.90 |
| `sv_t` | ES − AT | follows SPI(t) |
| `eac_t` | PD ÷ SPI(t) | follows SPI(t) |
| `delay_forecast` | (EAC(t) − PD) × daysPerUnit | follows SPI(t) |
| `tcpi_bac` (KPI-04) | (BAC − EV_cost) ÷ (BAC − AC) | ≤ 1.05 / ≤ 1.15 / > 1.15 |
| `ppc` (KPI-05) | Completed ÷ Planned Committed × 100 | ≥ 85 / ≥ 70 / < 70 |

## Adding a new KPI

1. Add any new raw input to `ControlsSnapshot` and fill it in `buildControlsSnapshot`, with source, asOf and a Persian reason when missing.
2. Write the pure formula in an engine file. It may throw on a domain error.
3. Define the KPI in `kpis.ts` with `buildExplainedMetric({ key, title_fa, unit, formula, asOf, inputs, inputLabels, compute })`.
4. Add a contract test: missing input gives gray/missing/null with a reason, and real input gives a computed value.
