# Schedule Intelligence Dashboard

Deterministic Construction Schedule Intelligence for Liparta / SitePilot — **no AI, no LLMs, no external APIs** for schedule math.

## Architecture

```
XML Upload (browser)
  → xmlParser.ts
  → scheduleQuality.ts (validation)
  → graph.ts + cpmEngine.ts (CPM)
  → riskAnalyzer.ts (rule-based scores)
  → scheduleMetrics.ts (KPIs, WBS phases)
  → executiveSummary.ts (Persian templates)
  → React dashboard UI
```

## Route

`/dashboard/schedule-intelligence` — tab **تحلیل زمان‌بندی** in header nav (PM, technical office, admin).

## CPM Formulas (integer minutes)

| Relation | Forward (ES_j) | Backward (LF_i) |
|----------|----------------|-----------------|
| FS | max(EF_i + lag) | min(LS_j - lag) |
| SS | max(ES_i + lag) | min(LS_j - lag + dur_i) |
| FF | max(EF_i + lag - dur_j) | min(EF_j - lag) |
| SF | max(ES_i + lag - dur_j) | min(EF_j - lag + dur_i) |

- Total Float = LS - ES
- Critical when Total Float ≤ 0 (configurable epsilon)
- Near-critical when float ≤ 10 working days (configurable)

## Network duration vs sum of durations

- **Network duration** = max EF of terminal activities (CPM) — true project length with parallelism.
- **Sum of activity durations** = workload-like aggregate — **not** project calendar length.

## Configuration

`lib/schedule-intelligence/config.ts` — analysis date, minutes/day, risk weights, thresholds.

## Tests

```bash
npm install
npm run test:schedule
```

Fixtures A–E in `tests/schedule/fixtures.ts`.

## Limitations

- Calendar from MSP is parsed but full working-calendar CPM is not applied; default 8h/day when calendar incomplete (warning shown).
- Summary tasks excluded from CPM; included in WBS grouping.
- Source Early/Late/Critical compared to calculated values; calculated values used for risk.

## Run app

```bash
npm.cmd run dev
```

Open http://localhost:3000/dashboard/schedule-intelligence and upload any Microsoft Project XML export.
