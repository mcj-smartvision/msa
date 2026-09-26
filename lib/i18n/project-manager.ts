import type { FormLocale } from '@/lib/project-init/i18n/types'

const EN = {
  title: 'Project Manager Dashboard',
  description: 'Project management workspace.',
} as const

const FA = {
  title: 'داشبورد مدیر پروژه',
  description: 'فضای کاری مدیر پروژه.',
} as const

export type ProjectManagerMessages = {
  title: string
  description: string
}

export function getProjectManagerMessages(locale: FormLocale): ProjectManagerMessages {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}
