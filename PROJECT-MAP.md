# SitePilot (MSA) Project Map

نام تجاری محصول **MSA** است. پوشه‌های «Liparta» در این ریپو وجود ندارند؛ معادل واقعی‌شان این است:

| نام قدیمی (قالب) | دامنه واقعی |
|---|---|
| `accounting/` | `features/finance/` + `features/evm/` + `features/project-controls/` |
| `warehouse/` | `features/storekeeper/` |
| `site/` | `features/supervisor/` + `features/site-ops/` |
| `dashboard/` | `features/dashboard/` + `features/manager/` |
| `shared/config/` | `shared/lib/i18n/` + `shared/lib/brand.ts` + `features/*/config.ts` |

---

## ساختار کلی پروژه

```
features/
├── schedule/              → زمان‌بندی، WBS، گانت، CPM، وزن پیشرفت
├── schedule-intelligence/ → آپلود MSP و کیفیت برنامه
├── finance/               → هزینه، بالاسری، صورت‌وضعیت، حسابدار
├── evm/                   → فرمول‌های CPI / SPI / RAG
├── project-controls/      → KPI توضیح‌پذیر، TCPI، PPC
├── storekeeper/           → انبار و موجودی
├── supervisor/            → سرپرست کارگاه، گزارش روزانه، زون
├── site-ops/              → دستورکار و عملیات کارگاه
├── dashboard/             → داشبورد نقش‌ها و ویجت‌ها
├── manager/               → اتاق فرمان مدیر پروژه
├── project-manager/       → کارتابل PM
├── project-store/         → منبع واحد پیشرفت (Zustand + persist)
├── admin/                 → کنترل سنتر
├── workshop/              → بسته‌های اجرایی
├── hse/ qc/ attendance/ procurement/ reports/ weather/ …
shared/
├── lib/                   → i18n، supabase، نقش‌ها، زمان تهران
├── components/            → UI پایه، هدر، تقویم
├── types/                 → قراردادهای مشترک
├── hooks/
app/                       → routing و layout
database/                  → مهاجرت‌های SQL (کاربر در SQL Editor اجرا می‌کند)
tests/
```

هدر `@file` روی **۷۸۸** فایل `features/`، `shared/` و `app/` گذاشته شده (config → lib → UI).

---

## لایه‌بندی وابستگی‌ها

```
config / i18n / types  → از UI و app چیزی نمی‌گیرند
lib / services         → فقط config، types، lib دیگر
components             → lib، config، types، components
app/                   → features و shared
```

ممنوع: `lib` از `components` یا `app` ایمپورت کند؛ import دایره‌ای.

---

## فایل‌های امن برای ویرایش (`@safe-to-edit YES`)

عمدتاً برچسب، locale و type خالص — تغییر متن اینجا JSX را نمی‌شکند:

- `shared/lib/brand.ts`
- `shared/lib/i18n/*.ts` (accountant, admin-member, app-shell, expenses, payables, position-labels, procurement, project-manager, qc, site-ops, site-supervisor, storekeeper, technical-office, locale-cookie)
- `features/dashboard/config.ts`
- `features/manager/lib/pulse-config.ts`
- `features/schedule-intelligence/lib/config.ts`
- `features/project-init/lib/i18n/locales/{fa,en,ar,de,fr}.ts`
- type-only: `features/*/lib/types.ts`, `features/finance/lib/{expense,invoice,payable,expense-ai}-types.ts`, `features/manager/lib/overview-types.ts`, `features/calc-trace/lib/types.ts`, …

---

## فایل‌های حساس (`@safe-to-edit CAREFUL`)

هر فایل منطق یا UI که عدد داشبورد، ذخیره، یا مسیر را عوض می‌کند. نمونهٔ پرریسک:

| فایل | چرا |
|---|---|
| `features/project-store/use-project-store.ts` | منبع واحد درصد پیشرفت |
| `features/evm/lib/metrics.ts` | CPI / SPI / EV |
| `features/evm/lib/rag-status.ts` | آستانه سبز/زرد/قرمز |
| `features/schedule/lib/cpm-calculate.ts` | شناوری و مسیر بحرانی |
| `features/schedule/lib/weighted-progress.ts` | پیشرفت وزنی |
| `features/supervisor/lib/persist-daily-progress.ts` | ذخیره گزارش روزانه |
| `features/manager/lib/load-manager-overview.ts` | اعداد اتاق فرمان |
| `features/project-controls/lib/kpis.ts` | KPI توضیح‌پذیر |
| `app/layout.tsx` | فونت و locale کل سایت |
| `features/manager/components/manager-dashboard.tsx` | شِل داشبورد مدیر |

بقیهٔ `lib/` و `components/` هم CAREFUL هستند مگر این‌که هدر YES باشد.

---

## نقشه feature به feature

### schedule
- کلید: `lib/cpm-calculate.ts`, `lib/weighted-progress.ts`, `lib/planned-progress.ts`, `components/schedule-gantt-workspace.tsx`
- وابسته به: `shared/types/schedule`, تعطیلات، پیشرفت سرپرست

### finance (accounting)
- کلید: `lib/types.ts`, `services/expense-ai.ts`, `components/costs-dashboard.tsx`
- وابسته به: برنامه برای بالاسری ماهانه، انبار برای ارزش موجودی

### storekeeper (warehouse)
- کلید: `lib/types.ts`, `components/storekeeper-dashboard.tsx`
- وابسته به: `shared/lib/i18n/storekeeper.ts`

### supervisor + site-ops (site)
- کلید: `supervisor/lib/progress-ledger.ts`, `persist-daily-progress.ts`, `components/daily-report-panel.tsx`
- وابسته به: schedule برای پنجره برنامه، weather برای مهر هوا

### dashboard + manager
- کلید: `dashboard/config.ts`, `dashboard/components/dashboard-client.tsx`, `manager/components/manager-dashboard.tsx`, `manager/lib/load-manager-overview.ts`
- وابسته به: project-store، evm، project-controls، finance

### evm + project-controls
- کلید: `evm/lib/metrics.ts`, `evm/lib/rag-status.ts`, `project-controls/lib/kpis.ts`
- وابسته به: بودجه و پیشرفت فیزیکی؛ بدون AC مقدار CPI ساخته نمی‌شود

---

## قوانین Cursor

`.cursor/rules/ai-friendly.mdc` · `config-first.mdc` · `ai-file-headers.mdc`

فیچر جدید: types → config → lib+test → component → `app/`.
