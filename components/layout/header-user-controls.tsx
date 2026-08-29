'use client'

import { HeaderProjectSwitcher } from '@/components/project/header-project-switcher'
import { HeaderUserMenu } from '@/components/account/header-user-menu'
import { HeaderLanguageSwitcher } from '@/components/i18n/header-language-switcher'

/** Header left cluster (RTL — user at screen left, then project, then language). */
export function HeaderUserControls({
  email,
  allowAllProject = false,
  showLanguage = false,
}: {
  email?: string
  allowAllProject?: boolean
  showLanguage?: boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2">
      {showLanguage ? <HeaderLanguageSwitcher /> : null}
      <HeaderProjectSwitcher allowAll={allowAllProject} className="min-w-0 max-w-[140px] sm:max-w-none" />
      <HeaderUserMenu email={email} />
    </div>
  )
}
