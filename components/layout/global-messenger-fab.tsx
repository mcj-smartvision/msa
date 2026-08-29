'use client'

import { MessengerButton } from '@/components/messaging/messenger-panel'

/** Fixed messenger entry — bottom-left on all dashboard pages. */
export function GlobalMessengerFab() {
  return (
    <div className="fixed bottom-4 left-4 z-[60] pointer-events-none">
      <div className="pointer-events-auto">
        <MessengerButton variant="fab" />
      </div>
    </div>
  )
}
