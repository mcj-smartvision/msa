import { ACCOUNT_PATHS, type AccountSection } from '@/features/account/lib/copy'

const POPUP_FEATURES = 'popup=yes,width=720,height=840,scrollbars=yes,resizable=yes'

export function openAccountPage(section: AccountSection) {
  const path = ACCOUNT_PATHS[section]
  const popup = window.open(path, 'msa-account', POPUP_FEATURES)
  if (!popup) {
    window.location.href = path
    return
  }
  popup.focus()
}

export function openProjectDirectory() {
  const popup = window.open(
    '/project-directory',
    'msa-projects',
    'popup=yes,width=1100,height=840,scrollbars=yes,resizable=yes'
  )
  if (!popup) {
    window.location.href = '/project-directory'
    return
  }
  popup.focus()
}

export function closeAccountPage(fallbackHref = '/admin') {
  if (window.opener && !window.opener.closed) {
    window.close()
    return
  }
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  window.location.href = fallbackHref
}
