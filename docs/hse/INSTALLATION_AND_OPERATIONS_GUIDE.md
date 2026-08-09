# SitePilot HSE — Installation and Operations Guide

**Audiences:** Installers / technical admins · Employers · HSE officers · Supervisors  
**Product surface:** SitePilot → `/dashboard/hse`  
**Companion docs:** [README](./README.md) · [Professional Product Guide](./PROFESSIONAL_PRODUCT_GUIDE.md)

---

## 1. Scope

This guide covers what you need to **install, configure, test, and maintain** camera-based HSE monitoring for a SitePilot project. It assumes SitePilot itself is already deployable (Node.js, Supabase env, `npm run build` / `npm start` or your hosting path).

HSE detection is **edge-first**: cameras feed an on-site edge node; SitePilot holds incidents, review, alerts, and analytics.

---

## 2. Hardware requirements

### 2.1 SitePilot hub (project office / cloud)

| Item | Guidance |
|------|----------|
| Host | Existing SitePilot deployment (VPS, container, or managed Next.js host) |
| Access | HTTPS to operators; outbound not required from browsers to cameras |
| Time | NTP-aligned clocks (hub and edge should agree within a few seconds) |
| Storage | Plan for evidence packages under retention policy (see Settings / `HSE_RETENTION_DAYS`) |

Operators use a modern browser. They do **not** need camera credentials.

### 2.2 Edge compute (on site)

| Item | Suggestion |
|------|------------|
| Form factor | Industrial mini-PC / NUC class, or Jetson-class / CUDA-class GPU box |
| CPU / accelerator | Dedicated GPU or NPU sized for concurrent analytic streams |
| Memory | 32 GB+ RAM for multi-camera mid-rise sites |
| Disk | SSD for OS + local clip ring buffer (size for peak event rate × retention-on-edge) |
| Network | NIC on camera VLAN; second path or VLAN for hub uplink preferred |
| Power | UPS covering edge node and PoE switches for critical cameras |
| Environment | Dust/temperature-rated enclosure if mounted in site cabins or plant rooms |

**Capacity planning (typical mid-rise):** 8–15 FPS per analytic stream at 1080p or 1440p, with headroom for two concurrent AI verification jobs on the hub or a designated verifier node.

### 2.3 Networking

- Wired camera backhaul preferred; reserved camera VLAN.  
- Outbound HTTPS from edge to SitePilot hub (future: `HSE_EDGE_API_URL`).  
- NTP to a reliable site or public time source.  
- Firewall: allow RTSP/ONVIF on camera VLAN; do not expose camera management ports to the public internet.

### 2.4 Suggested camera specs

| Spec | Recommendation |
|------|----------------|
| Type | Fixed IP camera; PTZ only if home position is reliable and documented |
| Resolution | 1080p minimum; 1440p where PPE or harness detail matters |
| Protocol | RTSP and/or ONVIF; NVR pull acceptable if edge can subscribe stably |
| Night | IR / low-light rated if night or poorly lit shifts are in scope |
| Mount | Stable mast/boom; vibration controlled on crane-adjacent views |
| Power | PoE preferred; UPS on switches feeding exclusion and edge-fall cameras |
| Placement | Hazard geometry readable in frame—not merely “area covered” |

**Avoid where possible:** heavy welding-flash flicker in the primary ROI; sun glare on PPE gates; sidewalks and empty-hook paths inside exclusion polygons.

### 2.5 Placement quick rules

| Use case | Placement note |
|----------|----------------|
| Exclusion ring | High, stable view that keeps the painted circle in frame during slew |
| Edge / fall | Oblique view that can see harness lines, not only silhouettes |
| PPE gate | Face inbound traffic; enough pixels on head and torso |
| Plant proximity | Clear apron; mount height often 4–8 m |
| After mast move | Mark camera **calibrating** until ROI sync is acknowledged |

Document ROI notes per camera in SitePilot (**Cameras**): what to ignore (boom tip, sidewalk, scaffold poles) and what must stay painted or tagged on site.

---

## 3. Installation steps

### Phase A — Survey (HSE officer + installer)

1. Walk zones with the HSE officer; mark risk level and required rules per area.  
2. Decide which existing cameras can be reused vs. new installs.  
3. Confirm contractor names for attribution in Overview comparison.  
4. Agree retention days and who receives critical Telegram/email alerts.

### Phase B — Field install

1. Install or re-aim cameras; record mount height, azimuth, and home position (PTZ).  
2. Confirm RTSP/ONVIF credentials on a **staging VLAN** before production cutover.  
3. Rack the edge node; join camera VLAN and hub uplink; verify NTP.  
4. Put critical cameras and the edge node on UPS / PoE budget.  
5. Clean lenses; verify night IR if night shifts are in scope.

### Phase C — SitePilot registration

1. Ensure SitePilot is running with Supabase env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).  
2. Sign in as a user with project access; open `/dashboard/hse`.  
3. Register cameras: name, code, source type (`rtsp` / `onvif` / `nvr` / `edge_usb`), FPS, resolution caps.  
4. Create zones; bind cameras; set risk.  
5. Enable rules per zone with **conservative** thresholds for week one.  
6. Configure alert routing (Telegram chat, email, webhook) and severity matrix; send a test alert.  
7. Map users to roles: employer, HSE officer, supervisor, technical admin.  
8. Walk Live Operations with the on-duty supervisor before go-live.

### Phase D — Future edge wiring (when available)

1. Set `HSE_EDGE_API_URL` on the hub (or edge agent config pointing at SitePilot).  
2. Set `HSE_TELEGRAM_BOT_TOKEN` for push delivery.  
3. Set `HSE_RETENTION_DAYS` (or Settings retention) to match employer policy.  
4. Apply HSE database migrations when shipped (replacing mock data in `lib/hse/mock-data.ts`).

---

## 4. Configuration steps

### 4.1 Cameras (`/dashboard/hse/cameras`)

- Unique code and location label.  
- Source type and stream parameters (FPS / resolution).  
- Calibration notes: tilt, pan, zoom, ROI ignore/include text.  
- Health expectations: online / degraded / offline / calibrating.  
- After scaffold rebuilds or mast moves: set calibrating until edge acknowledges ROI.

### 4.2 Zones (`/dashboard/hse/zones`)

- Name, code, area label, risk (critical / high / medium / low).  
- Bind cameras and rules that apply.  
- Notes for painters and supervisors (e.g. “ring must remain visible from CAM-03”).

### 4.3 Rules (`/dashboard/hse/rules`)

For each rule, set:

| Parameter | Guidance |
|-----------|----------|
| Confidence threshold | Start conservative; raise after labeled dismissals |
| Duration threshold | Short for exclusion / vehicle proximity; longer for PPE / smoking if brief gestures dominate |
| Cooldown | Prevent alert storms from one person standing in zone |
| Severity | Maps to alert routing and queue priority |
| Enabled | Pause a noisy rule rather than muting all Telegram alerts |

Tune **one parameter at a time** after the first week of labeled dismissals.

### 4.4 Alerts (`/dashboard/hse/alerts`)

- Channels: Telegram, email, webhook.  
- Route critical/high to on-duty phones; medium/low to digest or officer email as agreed.  
- Send a test message after any bot or webhook change.  
- Keep chat membership limited to required roles.

### 4.5 Settings (`/dashboard/hse/settings`)

- Evidence retention days.  
- AI shortlist verification on/off (recommended **on**).  
- Notification defaults for new users.  
- Project identity alignment with SitePilot project membership.

### 4.6 Roles (employer / HSE)

| Role | Configure / decide |
|------|--------------------|
| Technical admin | Cameras, calibration, edge health, channel wiring |
| HSE officer | Zones, rules, confirm/dismiss standards |
| Employer | Retention, escalation outcomes, contractor accountability |
| Supervisor | Live queue ownership; does not change camera credentials |

---

## 5. Testing checklist

Use before go-live and after major site geometry changes.

### Connectivity and time

- [ ] Edge reaches camera streams (RTSP/ONVIF) without packet loss spikes  
- [ ] Edge reaches SitePilot hub over HTTPS  
- [ ] NTP skew hub vs edge within acceptable window (few seconds)  
- [ ] UPS holds edge + critical PoE for planned outage duration  

### Cameras and zones

- [ ] Each analytic camera shows expected health in Cameras  
- [ ] ROI notes match painted geometry on site  
- [ ] Exclusion ring fully in frame under normal plant motion  
- [ ] PPE gate has usable pixels on hard hat / hi-vis  
- [ ] Night IR (if required) produces usable frames in ROI  

### Rules and evidence

- [ ] Controlled positive: known breach produces an incident package  
- [ ] Controlled false positive exercise (e.g. empty-hook transit, visitor vapor) → dismiss with reason  
- [ ] Evidence frames and clip buffer present on incident detail  
- [ ] Cooldown prevents duplicate storm for same standing person  
- [ ] Disabled rule produces no new events  

### AI and human review

- [ ] AI shortlist enabled produces verdict on shortlisted items  
- [ ] Uncertain / high-impact items remain in human queue  
- [ ] Acknowledge / confirm / dismiss / escalate / assign / close write decision log  
- [ ] Corrective action can be opened with owner and due date  

### Alerts and reporting

- [ ] Test Telegram (or email/webhook) for critical severity  
- [ ] Wrong chat / failed webhook visible in alert log  
- [ ] Reports CSV/export usable for employer pack  
- [ ] Retention setting understood by employer and HSE officer  

### Role walkthrough

- [ ] Supervisor clears Live Operations path under time pressure  
- [ ] HSE officer reviews dismiss reasons and one rule tweak  
- [ ] Employer sees Overview contractor comparison and escalation path  

---

## 6. Maintenance checklist

### Daily (supervisor / HSE)

- [ ] Camera health: online / degraded / offline / calibrating  
- [ ] Clear or action all critical/high items in Live Operations before shift end  
- [ ] Critical exclusion / fall: stop work on site first, then confirm in UI  

### Weekly (HSE officer + technical admin)

- [ ] Review dismiss reasons; adjust **one** rule threshold at a time  
- [ ] Verify Telegram test alert and webhook health if used  
- [ ] Check false-positive rate on Overview; pause noisiest rule if climbing  
- [ ] Confirm edge heartbeats and disk headroom on clip buffer  

### After weather or site change

- [ ] Clean lenses on apron and edge masts  
- [ ] Recheck ROI notes after covers, mast shifts, or scaffold rebuilds  
- [ ] Update zones and rule bindings when new decks/edges appear  
- [ ] Mark affected cameras calibrating until sync acknowledged  

### Monthly (employer + HSE)

- [ ] Export Reports pack; reconcile corrective action status  
- [ ] Confirm evidence age vs retention days before audits  
- [ ] Review contractor comparison; feed toolbox talks with confirmed cases  
- [ ] Reaffirm alert recipients for shift roster changes  

### Lane ownership

| Owner | Owns |
|-------|------|
| Technical admin | Edge heartbeats, calibration, stream credentials |
| HSE officer | Rule policy, confirmation standards, zone risk |
| Employer | Escalation outcomes, contractor accountability, retention |
| Supervisor | Shift queue discipline and decision notes |

---

## 7. Supervisor workflow (quick reference)

1. Open **Live Operations**.  
2. Select new or AI-review item; inspect frames, clip context, AI summary.  
3. **Acknowledge** to own the clock.  
4. Site-check if AI is uncertain or severity is critical/high.  
5. **Confirm**, **Dismiss** (with reason), **Escalate**, or **Assign**.  
6. Open corrective actions before leaving the shift; **Close** when done.  
7. Always leave a decision note an auditor can understand.

Do not dismiss uncertain high-impact events without a site check.

---

## 8. False-positive reduction

- Tighten ROI to exclude sidewalks, empty-hook paths, boom tips.  
- Raise duration for PPE/smoking if brief gestures dominate; keep exclusion/proximity short.  
- Use cooldowns to stop alert storms.  
- Keep AI verification on for borderline rules (hot-work OCR, stationary plant proximity).  
- Recalibrate after geometry changes.  
- Track false-positive rate on Overview; pause one noisy rule rather than silencing all alerts.

---

## 9. Safety and privacy notes

- Camera credentials stay with technical admins and the edge—not with office viewers.  
- Evidence is for shortlisted incidents under retention policy.  
- Limit Telegram chat membership to people who must act.  
- Critical life-safety response remains **on site** (stop work, barrier, rescue plan); the UI records and escalates—it does not replace site emergency procedures.

---

## 10. Troubleshooting (common)

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Camera offline | Power, PoE, VLAN, bad RTSP URL | Check switch/UPS; retest stream on staging tools |
| Degraded health | Packet loss, high CPU, FPS cap | Lower resolution/FPS; inspect edge load |
| Alert storm | Thresholds too low / cooldown zero | Raise duration or cooldown; tighten ROI |
| High false positives | ROI too wide / rule too sensitive | Dismiss with labels; tune one rule |
| No Telegram | Token/chat misconfig | Resend test; verify bot membership |
| Empty analytics | No confirmed data / mock-only demo | Confirm migrations/live edge when available |

---

## 11. Document control

| Item | Value |
|------|-------|
| Module path | `/dashboard/hse` |
| Mock data (current) | `lib/hse/mock-data.ts` |
| Future env | `HSE_EDGE_API_URL`, `HSE_TELEGRAM_BOT_TOKEN`, `HSE_RETENTION_DAYS` |
| In-app docs | `/dashboard/hse/documentation` |

Update this guide when edge APIs, HSE migrations, or alert channels go live in production.
