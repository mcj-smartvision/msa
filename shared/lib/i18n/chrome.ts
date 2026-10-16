/**
 * @file shared/lib/i18n/chrome.ts
 * @purpose برچسب هدر، سوییچر پروژه، تقویم، آخرین ورود و ضبط صدا
 * @safe-to-edit YES
 * @affects shared layout/chrome components
 * @depends-on features/project-init/lib/i18n/types
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'

const EN = {
  controlCenter: 'Control Center',
  members: 'Members',
  projects: 'Projects',
  dashboard: 'Dashboard',
  allProjects: 'All Projects',
  loadingProjects: 'Loading projects',
  project: 'Project',
  selectProject: 'Select project',
  calendar: 'Calendar',
  listSep: ', ',
  lastLogin: 'Last site login',
  lastLoginLoading: 'Loading...',
  lastLoginUnset: 'Not recorded',
  signOut: 'Sign out',
  voice: {
    noAudio: 'No audio was recorded. Please try again.',
    recordFailed: 'Recording failed.',
    micDenied: 'Microphone access denied. Check the browser microphone permission.',
    transcribeFailed: 'Transcription failed.',
    noSpeech: 'No speech was recognized. Please try again.',
    transcribing: 'Transcribing…',
    voiceInput: 'Voice input',
    stopConvert: 'Stop & convert',
    recording: 'Recording…',
    appendHint: 'Text will be appended',
    reviewHint: 'Review the transcript and edit if needed:',
    confirmInsert: 'Confirm & insert',
    discard: 'Discard',
  },
}

const FA: typeof EN = {
  controlCenter: 'کنترل سنتر',
  members: 'اعضا',
  projects: 'پروژه‌ها',
  dashboard: 'داشبورد',
  allProjects: 'همه پروژه‌ها',
  loadingProjects: 'بارگذاری پروژه‌ها',
  project: 'پروژه',
  selectProject: 'انتخاب پروژه',
  calendar: 'تقویم',
  listSep: '، ',
  lastLogin: 'آخرین ورود به سایت',
  lastLoginLoading: 'در حال بارگذاری...',
  lastLoginUnset: 'ثبت نشده',
  signOut: 'خروج',
  voice: {
    noAudio: 'صدایی ضبط نشد. دوباره تلاش کنید.',
    recordFailed: 'ضبط صدا با خطا متوقف شد.',
    micDenied: 'دسترسی به میکروفون ممکن نشد. اجازه میکروفون مرورگر را بررسی کنید.',
    transcribeFailed: 'تبدیل صدا به متن ناموفق بود.',
    noSpeech: 'متنی از صدا تشخیص داده نشد. دوباره تلاش کنید.',
    transcribing: 'در حال تبدیل…',
    voiceInput: 'ضبط صدا',
    stopConvert: 'توقف و تبدیل',
    recording: 'در حال ضبط…',
    appendHint: 'متن به فیلد اضافه می‌شود',
    reviewHint: 'متن استخراج‌شده را بررسی و در صورت نیاز اصلاح کنید:',
    confirmInsert: 'تأیید و درج در متن',
    discard: 'لغو',
  },
}

export type ChromeMessages = typeof EN

/**
 * Header, calendar, logout, project switcher, and voice-to-text labels.
 */
export function getChromeMessages(locale: FormLocale | string): ChromeMessages {
  if (locale === 'fa' || locale === 'ar') return FA
  return EN
}
