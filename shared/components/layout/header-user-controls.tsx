'use client'

import { HeaderProjectSwitcher } from '@/shared/components/project/header-project-switcher'
import { HeaderUserMenu } from '@/features/account/components/header-user-menu'
import { HeaderLanguageSwitcher } from '@/shared/components/i18n/header-language-switcher'

/** Header left cluster (RTL — user at screen left, project chip immediately after user). */
export function HeaderUserControls({
  email,
  allowAllProject = false,
  showLanguage = false,
  projectOptions = [],
}: {
  email?: string
  allowAllProject?: boolean
  showLanguage?: boolean
  projectOptions?: { id: string; name: string }[]
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2">
      <HeaderUserMenu email={email} />
      <HeaderProjectSwitcher
        allowAll={allowAllProject}
        initialProjects={projectOptions}
        className="min-w-0 max-w-[160px] sm:max-w-[200px]"
      />
      {showLanguage ? <HeaderLanguageSwitcher /> : null}
    </div>
  )
}
