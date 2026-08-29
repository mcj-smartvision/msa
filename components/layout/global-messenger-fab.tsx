'use client'

import { MessengerButton } from '@/components/messaging/messenger-panel'

/** Messenger — lower-left, subtle, not competing with main content. */
export function GlobalMessengerFab() {
  return (
    <div className="fixed bottom-16 left-5 z-[45] pointer-events-none sm:bottom-20 sm:left-6">
      <div className="pointer-events-auto">
        <MessengerButton variant="fab" />
      </div>
    </div>
  )
}
