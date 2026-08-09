# SitePilot HSE Camera Safety — Professional Product Guide

**Audience:** Employers, principals, and HSE leadership  
**Product surface:** SitePilot → `/dashboard/hse`  
**Use:** Employer demos, bid support, and go-live alignment

---

## What this product is

SitePilot HSE Camera Safety is an **operational control module** for construction and industrial sites. It watches designated zones through IP cameras, detects policy breaches (PPE, exclusion zones, fall exposure, hot work, plant proximity), packages evidence, and routes shortlisted events to people who can decide.

It is not a CCTV viewer and not a vanity dashboard. Every confirmed case can carry:

- Evidence frames and clip context  
- AI shortlist verdict (when enabled)  
- Immutable decision log (who acted, when, why)  
- Corrective actions with owners and due dates  
- Contractor attribution for toolbox talks and principal reviews  

The module runs inside **SitePilot**, so employers keep one login, one project membership model, and one operational hub for site readiness and HSE camera control.

---

## Why employers choose this design

### Edge-first

Detection runs on an on-site edge node close to the camera VLAN or NVR. Brief uplink outages do not stop local inference or clip buffering. The hub receives incident packages when connectivity allows; critical work on site is not blocked waiting for a cloud round-trip on every frame.

### Auditable

Human decisions are the system of record. Acknowledge, confirm, dismiss, escalate, assign, and close write to a decision log that later audits can read. AI assists; it does not silently close cases. Evidence retention is policy-driven so packs survive for employer review and contractor accountability.

### Scalable

Architecture separates **edge streams** from **hub review**. Office users work from incident packages and KPIs—they never need camera credentials. Additional cameras and zones scale by adding edge capacity and rule bindings, not by redesigning the control UI.

### Privacy-aware

Analytics and reports read from the hub store, not from continuous live frame streaming to every browser. Evidence is scoped to shortlisted incidents under retention settings. Roles limit who can confirm, escalate, or change camera/calibration settings. Camera credentials stay with technical admins and the edge runtime.

### Configurable

Zones, rules, confidence/duration thresholds, cooldowns, alert channels (Telegram, email, webhook), and severity routing are project-configurable. Conservative thresholds for the first week, then tuned from labeled dismissals—without code changes for routine policy updates.

### Enterprise-ready

Fits employer, HSE officer, supervisor, and technical admin roles. Supports contractor comparison, report export, retention policy, and a clear separation of lanes: technical admins own edge health and calibration; HSE officers own rule policy and confirmation standards; employers own escalation outcomes and contractor accountability.

---

## Architecture pillars

The control loop is six pillars. They map directly to how the product is demonstrated and operated.

### 1. Edge Vision Layer

On-site inference against active cameras and regions of interest (ROI). Streams typically arrive via RTSP/ONVIF (or temporary USB on masts). The edge holds zone geometry, rule thresholds, and calibration so detection continues if the hub uplink is degraded. Heartbeats report camera and node health to SitePilot.

**Employer takeaway:** Safety monitoring stays local to the site; the office sees outcomes, not raw camera passwords.

### 2. Rule Engine

Rules encode what “counts” as an event: confidence threshold, duration threshold, cooldown, severity, and which zones apply. Categories cover PPE gates, exclusion rings, fall exposure, hot-work permit presence, plant proximity, and similar site policies.

**Employer takeaway:** Policy is explicit and tunable. Noisy rules can be paused or tightened without silencing the whole system.

### 3. Evidence Package

When thresholds are met, the edge builds a package: key frames, a short clip buffer, rule metadata, camera/zone identity, and timestamps synchronized to site time. That package is what reviewers and AI see—not an unbounded live stream dump.

**Employer takeaway:** Decisions are grounded in evidence that can be shown in reviews and contractor meetings.

### 4. AI Verification (shortlist only)

A second-pass model reviews **shortlisted** packages only. It produces a verdict such as likely violation, uncertain, or likely false positive, with its own confidence. Optional OCR (for example hot-work permit boards) can support specific rules. High-impact and uncertain cases stay in the human queue.

**Employer takeaway:** AI reduces supervisor noise; it does not replace accountability.

### 5. Human Review

Supervisors and HSE officers work primarily in Live Operations and Incident detail:

| Action | Intent |
|--------|--------|
| Acknowledge | Stop the clock; someone owns the item |
| Confirm | Breach is real; proceed to corrective work |
| Dismiss | False positive; reason recorded |
| Escalate | Repeat or employer-level risk |
| Assign | Follow-up ownership |
| Close | Corrective steps complete |

Critical exclusion and fall events: stop work on site first, then confirm in the UI. Always leave a decision note an auditor can understand.

**Employer takeaway:** People remain accountable; the system makes that accountability visible.

### 6. Analytics

Overview KPIs, contractor comparison, open queues, false-positive trends, and report exports read from the hub store under retention policy. Stakeholders get packs without accessing live cameras.

**Employer takeaway:** Trends and contractor performance are measurable without turning HSE into CCTV tourism.

---

## Typical deployment picture

```
Cameras (RTSP/ONVIF/NVR)
        │
        ▼
Edge node (inference, ROI, clip buffer, heartbeat)
        │  incident packages (HTTPS)
        ▼
SitePilot hub (incidents, AI shortlist, alerts, RBAC, retention)
        │
        ├── Browser UI: /dashboard/hse/*
        └── Push: Telegram / email / webhook (critical & high)
```

- **Edge:** inference, ROI, clip buffer, heartbeat  
- **Hub:** incidents, AI shortlist, alerts, roles, exports  
- **Operators:** HTTPS browser UI; mobile Telegram for critical push  

---

## Roles in a real project

| Role | Primary job in HSE |
|------|--------------------|
| Employer | Escalation outcomes, contractor accountability, retention and reporting standards |
| HSE officer | Confirm / dismiss standards, rule policy, zone risk, toolbox follow-up |
| Supervisor | Live queue: acknowledge, assign, site check, close when actions done |
| Technical admin | Cameras, calibration, edge health, alert channel wiring |

Keep these lanes clear so the control center stays operational under shift pressure.

---

## Demo narrative (recommended order)

1. **Overview** — open incidents, severity mix, false-positive rate, contractor comparison.  
2. **Live Operations** — pick a critical/high item; show evidence frames and AI summary.  
3. **Incident detail** — walk decision log and a corrective action.  
4. **Cameras / Zones / Rules** — show that policy is configured, not hard-coded.  
5. **Alerts** — severity routing to Telegram/email/webhook.  
6. **Reports / Settings** — export path and retention / AI shortlist toggles.  

Emphasize: edge continues when uplink blips; AI is shortlist-only; humans own confirm/dismiss; analytics never require camera credentials in the office.

---

## Current implementation status (honest for demos)

- UI and operational workflows are implemented in SitePilot (Next.js App Router) under `/dashboard/hse`.  
- Auth and project membership reuse SitePilot Supabase.  
- HSE persistence tables are a future migration; the demo UI currently uses structured mock data in `lib/hse/mock-data.ts`.  
- Edge runtime URL, Telegram bot token, and retention days are reserved as future environment configuration (`HSE_EDGE_API_URL`, `HSE_TELEGRAM_BOT_TOKEN`, `HSE_RETENTION_DAYS`).

Use this guide to sell the **control model** and **architecture**. Pair with the [Installation and Operations Guide](./INSTALLATION_AND_OPERATIONS_GUIDE.md) for site rollout detail, and the [README](./README.md) for developer setup.

---

## Bottom line for principals

SitePilot HSE gives employers a **closed loop**: detect on the edge, package evidence, shortlist with AI, decide with people, and measure with analytics—inside the same SitePilot project they already use for site operations.
