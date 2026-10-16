/**
 * @file app/(dashboard)/dashboard/hse/live/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/hse/components/live-operations-page
 */

import { LiveOperationsPage } from '@/features/hse/components/live-operations-page'

export default function HseLiveRoute() {
  return <LiveOperationsPage />
}
