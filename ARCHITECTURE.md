# SitePilot-3 (MSA) — Architecture & Developer Manual

SitePilot-3 is a construction-site management platform (schedule/CPM, EVM, site operations, HSE, QC,
finance, attendance) built with **Next.js 14 (App Router)**, **Supabase** (Postgres + Auth + Storage),
**Tailwind CSS 3** and **TypeScript**. The UI is primarily Persian (RTL).

This document is the starting point for any developer joining the project: where things live, how a
page gets its data, and how to add new code without breaking the structure.

---

## 1. Quick start

```bash
npm install            # also copies face-api models (postinstall)
cp .env.local.example .env.local   # then fill in your own keys — never commit .env.local
npm run dev            # http://localhost:3000
npx tsc --noEmit -p .  # type-check (the project's main static check)
npx vitest run         # unit tests in tests/**
```

Required environment variables (see `.env.local.example`):

| Variable | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service client (API routes, never sent to the browser) |
| `OPENAI_API_KEY` | AI features (report parsing, transcription, expense analysis) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Site location picker |
| `TEAM_CALENDAR_API_KEY` | Team calendar message feed |

> On Windows, keep the project on an **NTFS** drive. On FAT32/exFAT drives `next build` fails with
> `EISDIR … readlink` (a Node/webpack file-system limitation, not a code issue). `next dev` works.

---

## 2. Folder structure (Feature-Based Architecture)

The rule of thumb: **code that belongs to one business area lives in `features/<area>/`; code that
every area needs lives in `shared/`.** `app/` only contains thin route files (Next.js requires it).

```
SitePilot-3/
├── app/                         # Next.js App Router — routes only (thin pages + API handlers)
│   ├── layout.tsx               # Root layout (fonts, providers)
│   ├── page.tsx                 # Landing page  →  features/landing
│   ├── globals.css
│   ├── (auth)/                  # login, signup, password reset (route group, no URL segment)
│   ├── (account)/               # profile, password, project directory
│   ├── (dashboard)/             # all authenticated app pages (dashboard shell layout)
│   │   ├── admin/               # control center, members, projects
│   │   ├── dashboard/           # role dashboards (manager, project-manager, hse, qc, ...)
│   │   ├── finance/  reports/  site-ops/  project/  settings/  first-login/
│   ├── (native-app)/            # accountant mobile shell (Capacitor)
│   └── api/                     # REST API route handlers (route.ts) — see §5
│
├── features/                    # One folder per business area
│   ├── <feature>/
│   │   ├── components/          # React components used only by this feature
│   │   ├── lib/                 # Domain logic, loaders, calculations, access checks
│   │   ├── services/            # Supabase data-access functions (browser or server)
│   │   └── hooks/               # React hooks specific to this feature
│   │
│   ├── account/                 # Profile, password, change requests
│   ├── admin/                   # Control center, members, projects, positions, routing
│   ├── attendance/              # Gates, face recognition, transit logs (lib only)
│   ├── compliance/              # Compliance rules (lib only)
│   ├── cre-contract/            # CRE contract parsing (lib only)
│   ├── dashboard/               # Generic role dashboard + widgets (components/widgets)
│   ├── evm/                     # Earned Value Management metrics & RAG status
│   ├── finance/                 # Costs, expenses, payables, accountant dashboards
│   ├── hse/                     # Safety: incidents, cameras, zones, rules, alerts
│   ├── landing/                 # Public landing page
│   ├── manager/                 # Manager "command room" dashboard
│   ├── procurement/             # Procurement dashboard
│   ├── project-controls/        # Controls snapshot (lib + server/)
│   ├── project-init/            # Project initialization wizard
│   ├── project-manager/         # PM dashboard, subcontractors, PM inbox (lib/pm-inbox)
│   ├── qc/                      # QC dashboard, drawings, QC engine (engine/)
│   ├── reports/                 # Report archive & report form
│   ├── schedule/                # Gantt, CPM, MSP import, progress, role access helpers
│   ├── schedule-intelligence/   # Schedule analytics dashboard
│   ├── security/                # Gate security dashboard, face enrollment
│   ├── site-ops/                # Daily plans, work orders, CRE runs (domain/ = core rules)
│   ├── storekeeper/             # Inventory dashboard
│   ├── supervisor/              # Site-supervisor tools, daily reports, zone maps
│   ├── technical-office/        # Technical office dashboard, drawings
│   ├── workshop/                # Workshop packages, approvals, flags, today/prepared
│   └── wwp/                     # Weekly work plans
│
├── shared/                      # Truly global, feature-agnostic code
│   ├── components/
│   │   ├── ui/                  # Design-system primitives (Button, Card, Input, Dialog, ...)
│   │   ├── layout/              # Dashboard shell, headers, sidebar footer
│   │   ├── common/              # Generic widgets (modal overlay, voice-to-text, AI draft viewer)
│   │   ├── auth/  brand/  i18n/ # Auth header, logo, locale provider
│   │   └── project/             # Header project switcher
│   ├── lib/
│   │   ├── supabase/            # client.ts, server.ts, service.ts, middleware.ts  ← DB connection
│   │   ├── auth/                # Auth helpers
│   │   ├── dashboard/           # Roles, role navigation, user context, post-login redirect
│   │   ├── project/             # Selected-project cookie
│   │   ├── i18n/                # Translation dictionaries (fa/en)
│   │   ├── common/  env/  time/  email/  maps/
│   │   └── utils.ts  brand.ts
│   ├── hooks/                   # use-supabase, use-synced-project-id
│   └── types/                   # Shared TypeScript types (admin, schedule, dashboard, ...)
│
├── middleware.ts                # Refreshes the Supabase session on every request
├── database/                    # Numbered SQL migrations (01-… to 10x-…), run manually in Supabase
├── supabase/                    # Supabase edge functions
├── tests/                       # Vitest unit tests (tests/<area>/*.test.ts)
├── scripts/                     # Maintenance scripts (backup, seeds, domain smoke tests)
├── public/                      # Static assets
├── android-accountant/  capacitor-www/   # Android shell for the accountant app
└── backend/                     # Legacy Python backend (not used by the Next.js app)
```

### Import conventions

- Always import with the `@/` alias (maps to the repo root): `@/features/manager/lib/format`,
  `@/shared/components/ui/button`.
- `shared/` must **never** import from `features/`.
- A feature may import another feature's public pieces when it genuinely depends on that domain
  (e.g. many features use `@/features/schedule/lib/access` for role checks). Prefer moving a helper
  to `shared/` once three or more features need it.
- Pages in `app/` should stay thin: auth/role check, then render one feature component.

---

## 3. Page Lookup Table

Dynamic segments are written as `[param]`. Most pages accept `?projectId=<uuid>` to select the project.
"File Path" lists the route file and, after the arrow, the main feature component it renders.

### Public & authentication

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Landing page | `/` | `app/page.tsx` → `features/landing/components/landing-page` |
| Login | `/login` | `app/(auth)/login/page.tsx` (client: `login-page-client.tsx`) |
| Sign up | `/signup` | `app/(auth)/signup/page.tsx` |
| Forgot password | `/forgot-password` | `app/(auth)/forgot-password/page.tsx` |
| Reset password | `/reset-password` | `app/(auth)/reset-password/page.tsx` |
| Choose accountant shell | `/choose-accountant-shell` | `app/(auth)/choose-accountant-shell/page.tsx` → `features/finance/components/choose-accountant-shell-client` |
| First login (password setup) | `/first-login` | `app/(dashboard)/first-login/page.tsx` (client: `first-login-client.tsx`) |

### Account

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Profile | `/account/profile` | `app/(account)/account/profile/page.tsx` → `features/account/components/account-profile-view` |
| Edit profile | `/account/edit` | `app/(account)/account/edit/page.tsx` → `features/account/components/account-edit-form` |
| Change password | `/account/password` | `app/(account)/account/password/page.tsx` → `features/account/components/account-password-form` |
| Change request | `/account/change-request` | `app/(account)/account/change-request/page.tsx` → `features/account/components/account-change-request-form` |
| Logout | `/account/logout` | `app/(account)/account/logout/page.tsx` → `features/account/components/account-logout-panel` |
| Project directory | `/project-directory` | `app/(account)/project-directory/page.tsx` → `features/admin/components/project-directory-page` |

### Admin / Control center

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Control center (overview, member dashboards, support, alerts) | `/admin` | `app/(dashboard)/admin/page.tsx` → `features/admin/components/admin-dashboard` |
| Members | `/admin/members` | `app/(dashboard)/admin/members/page.tsx` → `features/admin/components/admin-members-page` |
| Add member | `/admin/members/new` | `app/(dashboard)/admin/members/new/page.tsx` → `features/admin/components/add-member-page` |
| Projects | `/admin/projects` | `app/(dashboard)/admin/projects/page.tsx` → `features/admin/components/project-directory-table` |
| New project | `/admin/projects/new` | `app/(dashboard)/admin/projects/new/page.tsx` → `features/admin/components/project-creation-page` |
| Initialize project | `/admin/projects/initialize` | `app/(dashboard)/admin/projects/initialize/page.tsx` → `features/project-init/components/project-form` |
| Project (redirects to members) | `/admin/projects/[projectId]` | `app/(dashboard)/admin/projects/[projectId]/page.tsx` |
| Project members | `/admin/projects/[projectId]/members` | `app/(dashboard)/admin/projects/[projectId]/members/page.tsx` → `features/admin/components/member-form` |
| Member detail | `/admin/projects/[projectId]/members/[memberId]` | `app/(dashboard)/admin/projects/[projectId]/members/[memberId]/page.tsx` |
| Positions | `/admin/projects/[projectId]/positions` | `app/(dashboard)/admin/projects/[projectId]/positions/page.tsx` → `features/admin/components/position-form` |
| Notification routing | `/admin/projects/[projectId]/routing` | `app/(dashboard)/admin/projects/[projectId]/routing/page.tsx` → `features/admin/components/notification-route-editor` |
| Widget visibility | `/admin/projects/[projectId]/widgets` | `app/(dashboard)/admin/projects/[projectId]/widgets/page.tsx` → `features/admin/components/widget-visibility-editor` |
| Settings | `/settings` | `app/(dashboard)/settings/page.tsx` → `features/schedule/components/header-calendar-switcher` |

### Role dashboards

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Generic role dashboard | `/dashboard` | `app/(dashboard)/dashboard/page.tsx` → `features/dashboard/components/dashboard-client` |
| Manager command room | `/dashboard/manager` | `app/(dashboard)/dashboard/manager/page.tsx` → `features/manager/components/manager-dashboard` |
| Manager — all alerts | `/dashboard/manager/alerts` | `app/(dashboard)/dashboard/manager/alerts/page.tsx` → `features/manager/components/manager-dashboard` |
| Manager — calculation background | `/dashboard/manager/background` | `app/(dashboard)/dashboard/manager/background/page.tsx` → `features/manager/components/manager-dashboard` |
| Project manager | `/dashboard/project-manager` | `app/(dashboard)/dashboard/project-manager/page.tsx` → `features/project-manager/components/project-manager-dashboard` |
| Technical office (incl. Gantt) | `/dashboard/technical-office` | `app/(dashboard)/dashboard/technical-office/page.tsx` → `features/technical-office/components/technical-office-dashboard` |
| Schedule intelligence | `/dashboard/schedule-intelligence` | `app/(dashboard)/dashboard/schedule-intelligence/page.tsx` → `features/schedule-intelligence/components/schedule-intelligence-dashboard` |
| Site supervisor | `/dashboard/site-supervisor` | `app/(dashboard)/dashboard/site-supervisor/page.tsx` → `features/schedule/components/site-supervisor-dashboard` |
| Supervisor — daily reports | `/dashboard/site-supervisor/daily-reports` | `app/(dashboard)/dashboard/site-supervisor/daily-reports/page.tsx` → `features/supervisor/components/daily-report-history-page` |
| Supervisor — inspection drawings | `/dashboard/site-supervisor/inspection-drawings` | `app/(dashboard)/dashboard/site-supervisor/inspection-drawings/page.tsx` → `features/qc/components/qc-office-drawings-page` |
| Supervisor — safety alerts | `/dashboard/site-supervisor/safety-alerts` | `app/(dashboard)/dashboard/site-supervisor/safety-alerts/page.tsx` → `features/hse/components/safety-alerts-page` |
| Supervisor — incident detail | `/dashboard/site-supervisor/incidents/[id]` | `app/(dashboard)/dashboard/site-supervisor/incidents/[id]/page.tsx` → `features/hse/components/incident-detail-page` |
| Supervisor — zone map | `/dashboard/site-supervisor/zones/[zoneId]` | `app/(dashboard)/dashboard/site-supervisor/zones/[zoneId]/page.tsx` → `features/supervisor/components/zone-map-full-page` |
| QC inspector | `/dashboard/qc` | `app/(dashboard)/dashboard/qc/page.tsx` → `features/qc/components/qc-dashboard` |
| QC drawings | `/dashboard/qc/drawings` | `app/(dashboard)/dashboard/qc/drawings/page.tsx` → `features/qc/components/qc-office-drawings-page` |
| Storekeeper | `/dashboard/storekeeper` | `app/(dashboard)/dashboard/storekeeper/page.tsx` → `features/storekeeper/components/storekeeper-dashboard` |
| Procurement | `/dashboard/procurement` | `app/(dashboard)/dashboard/procurement/page.tsx` → `features/procurement/components/procurement-dashboard` |
| Accountant | `/dashboard/accountant` | `app/(dashboard)/dashboard/accountant/page.tsx` → `features/finance/components/accountant-dashboard` |
| Security (gates) | `/dashboard/security` | `app/(dashboard)/dashboard/security/page.tsx` → `features/security/components/security-dashboard` |
| Security — face enrollment | `/dashboard/security/enroll` | `app/(dashboard)/dashboard/security/enroll/page.tsx` → `features/security/components/face-enroll-wizard-client` |

### HSE (safety)

| Page Name | Route URL | File Path |
| --- | --- | --- |
| HSE overview | `/dashboard/hse` | `app/(dashboard)/dashboard/hse/page.tsx` → `features/hse/components/overview-page` |
| Live operations | `/dashboard/hse/live` | `app/(dashboard)/dashboard/hse/live/page.tsx` → `features/hse/components/live-operations-page` |
| Alerts | `/dashboard/hse/alerts` | `app/(dashboard)/dashboard/hse/alerts/page.tsx` → `features/hse/components/alerts-page` |
| Cameras | `/dashboard/hse/cameras` | `app/(dashboard)/dashboard/hse/cameras/page.tsx` → `features/hse/components/cameras-page` |
| Incidents | `/dashboard/hse/incidents` | `app/(dashboard)/dashboard/hse/incidents/page.tsx` → `features/hse/components/incidents-page` |
| Incident detail | `/dashboard/hse/incidents/[id]` | `app/(dashboard)/dashboard/hse/incidents/[id]/page.tsx` → `features/hse/components/incident-detail-page` |
| Zones | `/dashboard/hse/zones` | `app/(dashboard)/dashboard/hse/zones/page.tsx` → `features/hse/components/zones-page` |
| Rules | `/dashboard/hse/rules` | `app/(dashboard)/dashboard/hse/rules/page.tsx` → `features/hse/components/rules-page` |
| Reports | `/dashboard/hse/reports` | `app/(dashboard)/dashboard/hse/reports/page.tsx` → `features/hse/components/reports-page` |
| Documentation | `/dashboard/hse/documentation` | `app/(dashboard)/dashboard/hse/documentation/page.tsx` → `features/hse/components/documentation-page` |
| Settings | `/dashboard/hse/settings` | `app/(dashboard)/dashboard/hse/settings/page.tsx` → `features/hse/components/settings-page` |

### Site operations & workshop

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Site-ops overview | `/site-ops` | `app/(dashboard)/site-ops/page.tsx` → `features/site-ops/components/overview-client` |
| Workshop schedule | `/site-ops/schedule` | `app/(dashboard)/site-ops/schedule/page.tsx` → `features/workshop/components/schedule-workspace` |
| Approvals | `/site-ops/approvals` | `app/(dashboard)/site-ops/approvals/page.tsx` → `features/workshop/components/approvals-workspace` |
| Prepared packages | `/site-ops/prepared` | `app/(dashboard)/site-ops/prepared/page.tsx` → `features/workshop/components/prepared-workspace` |
| Today | `/site-ops/today` | `app/(dashboard)/site-ops/today/page.tsx` → `features/workshop/components/today-workspace` |
| Flags | `/site-ops/flags` | `app/(dashboard)/site-ops/flags/page.tsx` → `features/workshop/components/flags-workspace` |
| Daily plans | `/site-ops/daily-plans` | `app/(dashboard)/site-ops/daily-plans/page.tsx` → `features/site-ops/components/daily-plans-client` |
| Daily plan detail | `/site-ops/daily-plans/[date]` | `app/(dashboard)/site-ops/daily-plans/[date]/page.tsx` → `features/site-ops/components/daily-plan-detail-client` |
| Work order | `/site-ops/work-orders/[id]` | `app/(dashboard)/site-ops/work-orders/[id]/page.tsx` → `features/site-ops/components/work-order-client` |
| Exceptions | `/site-ops/exceptions` | `app/(dashboard)/site-ops/exceptions/page.tsx` → `features/site-ops/components/exceptions-client` |
| CRE runs | `/site-ops/cre-runs` | `app/(dashboard)/site-ops/cre-runs/page.tsx` → `features/site-ops/components/cre-runs-client` |
| CRE run detail | `/site-ops/cre-runs/[id]` | `app/(dashboard)/site-ops/cre-runs/[id]/page.tsx` → `features/site-ops/components/cre-run-detail-client` |
| Daily site report | `/site-ops/reports/daily` | `app/(dashboard)/site-ops/reports/daily/page.tsx` → `features/site-ops/components/daily-report-client` |

### Finance, reports & project

| Page Name | Route URL | File Path |
| --- | --- | --- |
| Project costs | `/finance/costs` | `app/(dashboard)/finance/costs/page.tsx` → `features/finance/components/costs-dashboard` |
| Expenses | `/finance/expenses` | `app/(dashboard)/finance/expenses/page.tsx` → `features/finance/components/expense-management` |
| Contractor payables | `/finance/payables` | `app/(dashboard)/finance/payables/page.tsx` → `features/finance/components/contractor-payables` |
| Subcontractors | `/project/subcontractors` | `app/(dashboard)/project/subcontractors/page.tsx` → `features/project-manager/components/pm-subcontractors-page-client` |
| Reports archive | `/reports` | `app/(dashboard)/reports/page.tsx` → `features/reports/components/reports-archive` |
| New report | `/reports/new` | `app/(dashboard)/reports/new/page.tsx` → `features/reports/components/report-form` |
| Accountant mobile app | `/accountant-app` | `app/(native-app)/accountant-app/page.tsx` → `features/finance/components/accountant-native-app` |

---

## 4. Data flow

```
Browser (React client component in features/*/components)
   │  1. fetch('/api/...?...&projectId=')            or   2. Supabase JS (anon key, RLS)
   ▼                                                        via useSupabase() + features/*/services
app/api/**/route.ts  (thin HTTP handler)
   │  createClient()        — shared/lib/supabase/server.ts  (user session from cookies)
   │  requireUser + access  — e.g. features/site-ops/lib/auth, features/manager/lib/access
   │  createServiceClient() — shared/lib/supabase/service.ts (service role, server only)
   ▼
features/<area>/lib/*      (loaders & domain logic: queries, calculations, aggregation)
   ▼
Supabase Postgres  (tables & RLS defined by database/*.sql)
```

1. **Session.** `middleware.ts` calls `shared/lib/supabase/middleware.ts` on every request to refresh the
   Supabase auth cookie.
2. **Server pages.** Route files in `app/(dashboard)/…/page.tsx` are mostly server components. They read
   the user with `shared/lib/supabase/server.ts`, check the role
   (`features/schedule/lib/access.ts → hasRoleDashboardAccess`, `shared/lib/dashboard/*`), redirect to
   `/login` when needed, then render a feature component with initial props.
3. **Client data loading** happens in one of two ways:
   - **API routes (preferred for anything non-trivial).** The component calls `fetch('/api/<area>/…')`.
     The handler authenticates, checks project access, then calls a loader in
     `features/<area>/lib/` (e.g. `features/manager/lib/load-manager-overview.ts`). Loaders return typed
     results; dashboards use the `SectionResult` pattern (`ok | unavailable | error`) so one failing
     section never breaks the page.
   - **Direct Supabase queries** for simple CRUD (mostly admin). The component gets a browser client
     with `shared/hooks/use-supabase.ts` and calls functions in `features/<area>/services/*.ts`, which
     receive the `SupabaseClient` as their first argument. Row-Level Security protects these queries.
4. **Writes** go through API routes (`POST/PATCH/DELETE` handlers) so validation and permission checks
   stay on the server.
5. **AI features** (`/api/ai/transcribe`, `/api/analyze-report`, `/api/finance/analyze-expense`,
   `/api/schedule/parse-daily-report`, `/api/supervisor/organize-daily-report`) call OpenAI from the
   server using `OPENAI_API_KEY`.

### Where to find the API connections

| What | Where |
| --- | --- |
| Supabase browser client | `shared/lib/supabase/client.ts` (via `shared/hooks/use-supabase.ts`) |
| Supabase server client (user session) | `shared/lib/supabase/server.ts` |
| Supabase service-role client (server only) | `shared/lib/supabase/service.ts` |
| Session refresh | `middleware.ts` → `shared/lib/supabase/middleware.ts` |
| HTTP API handlers | `app/api/<area>/**/route.ts` |
| Client-side data-access functions | `features/<area>/services/*.ts` |
| Server loaders / domain logic | `features/<area>/lib/*.ts` |
| Database schema & migrations | `database/NN-*.sql` (apply in order in the Supabase SQL editor) |
| Scheduled job | `app/api/cron/progress-snapshots/route.ts` |

### API route map

| Area | Base path | Examples |
| --- | --- | --- |
| Account / auth | `/api/account`, `/api/auth` | `change-request`, `post-login`, `my-last-login` |
| Admin | `/api/admin` | `invite-member`, `update-member`, `reset-member-password`, `projects`, `seed-positions` |
| Manager | `/api/manager` | `overview`, `controls`, `cumulative-progress`, `weekly-plan`, `weekly-commitments`, `period-comparison`, `remind` |
| Project manager | `/api/project-manager` | `evm`, `controls` |
| Schedule | `/api/schedule` | `gantt`, `calculate` (CPM), `import-msp`, `preview`, `progress-pace`, `planned-weights`, `dependency-network`, `alerts` |
| Workshop | `/api/workshop` | `packages/[id]/{submit,approve,reject,send-to-today,…}`, `approvals`, `today`, `prepared`, `flags` |
| Site ops | `/api/site-ops` | `daily-plans`, `work-orders/[id]`, `cre-runs`, `blockers`, `exceptions`, `reports/daily` |
| Supervisor | `/api/supervisor` | `today-activities`, `daily-progress`, `organize-daily-report` |
| Technical office | `/api/technical-office` | `drawings`, `drawings/[id]/file` |
| QC engine | `/api/qc-engine` | `requests`, `checklist`, `results`, `photos`, `dashboard` |
| Attendance | `/api/attendance` | `recognize`, `transit`, `gates`, `enrollments`, `dashboard` |
| Finance | `/api/finance` | `live-costs`, `contractor-costs`, `analyze-expense` |
| Weekly work plans | `/api/wwp` | `/api/wwp`, `[id]`, `commitments/[id]` |
| Misc | `/api/health`, `/api/reports/monthly-progress`, `/api/cron/progress-snapshots` | |

---

## 5. How to…

**Add a new page**
1. Put the UI in `features/<area>/components/<my-page>.tsx` (create the feature folder if it is a new area).
2. Create the route file `app/(dashboard)/<url>/page.tsx`: check the user/role, then render the component.
3. If it needs navigation, add it to the relevant nav config (`shared/lib/dashboard/role-nav.ts`, or
   `features/manager/lib/manager-nav.ts` for the manager dashboard).
4. Add a row to the Page Lookup Table above.

**Add a new API endpoint**
1. Write the logic in `features/<area>/lib/` (pure functions + loaders that receive a Supabase client).
2. Create `app/api/<area>/<name>/route.ts`. Use `createClient()` for the user session, check access,
   and only use `createServiceClient()` on the server.
3. Call it from the client with `fetch('/api/<area>/<name>?projectId=…')`.

**Add a database change**
Add the next numbered file in `database/` (e.g. `103-my-change.sql`) and run it in the Supabase SQL
editor. Code that reads new tables should handle "relation does not exist" gracefully (many loaders
return `unavailable` in that case).

**Add a shared component**
Only put it in `shared/components/` if it has no knowledge of any business area (no project/schedule
types, no feature imports). Otherwise keep it in the feature.

---

## 6. Conventions & gotchas

- **File names are kebab-case** everywhere (`manager-dashboard.tsx`, `use-reports.ts`, `cpm-engine.ts`).
  The exported component/function inside keeps its normal casing (`ManagerDashboard`, `useReports`).
- **RTL & Persian.** Pages use `dir="rtl"`; use Persian digits for displayed numbers (see helpers such as
  `features/manager/lib/format.ts`). Charts (recharts) are wrapped in `dir="ltr"` so time runs left to right.
- **Dates.** "Today" is computed in the Tehran time zone on the server (`todayIsoTehran()`).
- **Real data only.** Dashboards never show placeholder numbers: when a source table is empty or missing,
  the section shows an explicit "no data / not connected" state.
- **Secrets.** Never commit `.env.local` and never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- **Tailwind** scans `app/`, `features/` and `shared/` (see `tailwind.config.ts`). If you add source
  folders elsewhere, add them to `content`.
- **Checks before pushing:** `npx tsc --noEmit -p .` and `npx vitest run`.
