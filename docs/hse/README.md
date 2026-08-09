# SitePilot HSE Camera Safety

Construction-site camera HSE monitoring, integrated into SitePilot at `/dashboard/hse`.

## Purpose

SitePilot HSE turns site cameras into an auditable safety control loop:

**Edge vision → rules → evidence → AI verify (shortlist) → human review → analytics**

| Stage | Role |
|--------|------|
| Edge vision | On-site inference against camera ROIs and zones |
| Rules | Confidence, duration, cooldown, and severity thresholds |
| Evidence | Key frames, short clip buffer, rule metadata, site timestamps |
| AI verification | Second-pass review of shortlisted events only |
| Human review | Supervisor / HSE officer decisions with immutable decision log |
| Analytics | KPIs, contractor comparison, reports, retention-aware exports |

The UI is built for employers, HSE officers, supervisors, and technical admins—not marketing dashboards.

## Implementation note

This module is implemented **inside SitePilot** (Next.js App Router), not as a separate Vite app. It uses the same stack as the rest of the product:

- React + TypeScript
- Tailwind CSS
- Supabase (auth and project membership)
- Lucide icons

App code lives under `app/(dashboard)/dashboard/hse/`, `components/hse/`, and `lib/hse/`.

## Setup

1. Clone the SitePilot repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment template and fill values:

   ```bash
   cp .env.local.example .env.local
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Sign in with a SitePilot account that has project access, then open `/dashboard/hse` (default landing for the `hse_officer` role).

## Environment variables

### Required (SitePilot / Supabase)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |

### Future HSE placeholders

These are not required for the current mock-data UI. Reserve them for edge, alerting, and retention wiring:

| Variable | Purpose |
|----------|---------|
| `HSE_EDGE_API_URL` | Base URL for the on-site edge runtime API |
| `HSE_TELEGRAM_BOT_TOKEN` | Telegram bot token for critical/high push alerts |
| `HSE_RETENTION_DAYS` | Default evidence retention window (days) |

Do not commit `.env.local`. Use `.env.local.example` as the shared template.

## Supabase notes

- **Auth and project membership** reuse SitePilot’s existing Supabase setup. HSE screens sit behind the same dashboard session and project context.
- **HSE incident tables** (cameras, zones, rules, incidents, evidence, decision log, alerts) are a **future migration**. They are not in the current schema.
- Until those migrations land, the HSE UI reads **mock data** from `lib/hse/mock-data.ts` (demo project, cameras, zones, rules, incidents, KPIs, and alert routing).

## Run and build

| Command | Use |
|---------|-----|
| `npm run dev` | Local development (Next.js) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

## App routes (`/dashboard/hse/*`)

| Route | Screen |
|-------|--------|
| `/dashboard/hse` | Overview — KPIs, contractor comparison, action queue |
| `/dashboard/hse/live` | Live Operations — real-time review queue |
| `/dashboard/hse/incidents` | Incidents list |
| `/dashboard/hse/incidents/[id]` | Incident detail — evidence, AI verdict, decision log, corrective actions |
| `/dashboard/hse/cameras` | Camera registry, health, calibration notes |
| `/dashboard/hse/zones` | Zones and risk bindings |
| `/dashboard/hse/rules` | Detection rules (thresholds, cooldowns, enable/disable) |
| `/dashboard/hse/alerts` | Alert routing and delivery log |
| `/dashboard/hse/reports` | Reports and CSV-oriented exports |
| `/dashboard/hse/documentation` | In-app installer / officer documentation |
| `/dashboard/hse/settings` | Project HSE settings (retention, AI shortlist, notification defaults) |

## Related docs

- [Professional Product Guide](./PROFESSIONAL_PRODUCT_GUIDE.md) — employer-facing architecture and value
- [Installation and Operations Guide](./INSTALLATION_AND_OPERATIONS_GUIDE.md) — hardware, install, config, testing, maintenance
