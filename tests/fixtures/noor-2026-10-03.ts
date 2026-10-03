import type { EvmActivity } from '@/lib/evm/metrics'

/**
 * Noor project (023edfc0-6021-4969-a419-b3bdf2ee88fd) as served by /api/project-manager/evm on
 * 2026-10-03 (Tehran): leaf tasks and the two wall packages with their absolute schedule weights
 * (sum 100), contract-value budgets, frozen baseline dates and approved physical percent.
 * AC is not recorded and no WWP week exists, so TCPI and PPC are data-missing for this project.
 */
export const NOOR_PROJECT_ID = '023edfc0-6021-4969-a419-b3bdf2ee88fd'
export const NOOR_STATUS_DATE = '2026-10-03'

export const NOOR_ACTIVITIES: EvmActivity[] = [
  { id: '63da68b4-524c-4413-97ce-c1db4ce561bc', name: 'دیوار 35 سانتی', weight: 11, budget: 200, baselineStart: '2026-03-12', baselineFinish: '2026-03-29', physicalPercent: 45 },
  { id: '66fa874f-0a1f-4c76-b48d-44e3341f9dd8', name: 'دیوار 10سانتی', weight: 6, budget: 200, baselineStart: '2026-03-12', baselineFinish: '2026-03-29', physicalPercent: 65 },
  { id: '706acbcc-3bc4-4712-86e1-cc020b19027b', name: '۱. تحویل زمین', weight: 5, budget: 600, baselineStart: '2026-01-04', baselineFinish: '2026-01-05', physicalPercent: 100 },
  { id: '649a7689-de79-4bb8-9851-3c3e23519f8a', name: '۲. تجهیز کارگاه', weight: 5, budget: 400, baselineStart: '2026-01-06', baselineFinish: '2026-01-11', physicalPercent: 100 },
  { id: 'dc721bf6-17d2-4772-9bee-4387d605b690', name: '۳. خاکبرداری', weight: 5, budget: 100, baselineStart: '2026-01-13', baselineFinish: '2026-01-19', physicalPercent: 100 },
  { id: '9a07a781-d7bc-4c61-93e3-440426135903', name: '۴.۱ آرماتوربندی فونداسیون', weight: 7, budget: 100, baselineStart: '2026-01-25', baselineFinish: '2026-01-31', physicalPercent: 100 },
  { id: '2f0dbbb4-5889-4e14-8567-1ba552d6de24', name: '۴.۲ قالب‌بندی فونداسیون', weight: 4, budget: 100, baselineStart: '2026-01-20', baselineFinish: '2026-01-22', physicalPercent: 100 },
  { id: '21647228-6dfb-4fd0-af9e-f82b55b2d2f1', name: '۴.۳ روغن‌کاری قالب فونداسیون', weight: 2, budget: 100, baselineStart: '2026-01-25', baselineFinish: '2026-01-25', physicalPercent: 100 },
  { id: 'cc371e1e-7ac1-4f28-9a1b-754595860aaa', name: '۴.۴ بتن‌ریزی فونداسیون', weight: 7, budget: 100, baselineStart: '2026-02-01', baselineFinish: '2026-02-02', physicalPercent: 100 },
  { id: 'e429606f-322c-4032-ac4b-1b798a45d356', name: '۵.۱ اجرای ستون‌ها', weight: 9, budget: 100, baselineStart: '2026-02-07', baselineFinish: '2026-02-17', physicalPercent: 75 },
  { id: 'b4e90a84-c667-44a5-811c-8ae50b0b99a7', name: '۵.۲ اجرای تیرها و سقف', weight: 11, budget: 200, baselineStart: '2026-02-24', baselineFinish: '2026-03-09', physicalPercent: 55 },
  { id: '4319d6d4-bdc8-43ef-bbe7-84bc4ec217a5', name: '۷. تاسیسات مکانیکی و برقی (زیرسازی)', weight: 8, budget: 200, baselineStart: '2026-03-10', baselineFinish: '2026-03-23', physicalPercent: 75 },
  { id: 'd28713f4-2058-477d-b251-5d989ad9306b', name: '۸.۱ گچ‌کاری', weight: 3, budget: 100, baselineStart: '2026-03-30', baselineFinish: '2026-04-09', physicalPercent: 100 },
  { id: '997f5a90-61df-46d1-b724-a7908cd0370a', name: '۸.۲ کاشی و سرامیک', weight: 3, budget: 200, baselineStart: '2026-04-12', baselineFinish: '2026-04-20', physicalPercent: 100 },
  { id: '11ebed8b-4a85-4c16-beb7-fcd90e064e89', name: '۸.۳ رنگ‌آمیزی', weight: 3, budget: 400, baselineStart: '2026-04-22', baselineFinish: '2026-04-28', physicalPercent: 100 },
  { id: '20993859-8a2d-4680-9a54-1c6b7fd94242', name: '۹. اجرای نما', weight: 6, budget: 100, baselineStart: '2026-04-29', baselineFinish: '2026-05-10', physicalPercent: 40 },
  { id: '3b307695-2469-412c-880b-a8da5579f960', name: '۱۰. تحویل نهایی پروژه', weight: 5, budget: 100, baselineStart: '2026-05-10', baselineFinish: '2026-05-10', physicalPercent: 0 },
]
