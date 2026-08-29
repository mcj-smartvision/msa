'use client'

import { HeaderProjectSwitcher } from '@/components/project/header-project-switcher'
import { HeaderUserMenu } from '@/components/account/header-user-menu'

/** Header left cluster: project selector + user menu (RTL — user at screen left). */
export function HeaderUserControls({
  email,
  allowAllProject = false,
}: {
  email?: string
  allowAllProject?: boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2">
      <HeaderProjectSwitcher allowAll={allowAllProject} className="min-w-0 max-w-[140px] sm:max-w-none" />
      <HeaderUserMenu email={email} />
    </div>
  )
}
