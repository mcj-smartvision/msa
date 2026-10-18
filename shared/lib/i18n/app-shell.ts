/**
 * @file shared/lib/i18n/app-shell.ts
 * @purpose تنظیمات و برچسب‌ها — زیرساخت مشترک سامانه (app-shell)
 * @safe-to-edit YES
 * @affects زیرساخت مشترک سامانه
 * @depends-on features/project-init/lib/i18n/types
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'

export interface AppShellMessages {
  reports: string
  newReport: string
  admin: string
  settings: string
  signOut: string
  language: string
  calendar: string
  login: string
  email: string
  username: string
  password: string
  signIn: string
  forgotPassword: string
}

export const APP_SHELL: Record<FormLocale, AppShellMessages> = {
  fa: {
    reports: 'گزارش‌ها',
    newReport: 'گزارش جدید',
    admin: 'مدیریت',
    settings: 'تنظیمات',
    signOut: 'خروج',
    language: 'زبان',
    calendar: 'تقویم',
    login: 'ورود',
    email: 'ایمیل',
    username: 'نام کاربری',
    password: 'رمز عبور',
    signIn: 'ورود',
    forgotPassword: 'فراموشی رمز؟',
  },
  en: {
    reports: 'Reports',
    newReport: 'New Report',
    admin: 'Admin',
    settings: 'Settings',
    signOut: 'Sign out',
    language: 'Language',
    calendar: 'Calendar',
    login: 'Sign in',
    email: 'Email',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    forgotPassword: 'Forgot password?',
  },
  de: {
    reports: 'Berichte',
    newReport: 'Neuer Bericht',
    admin: 'Administration',
    settings: 'Einstellungen',
    signOut: 'Abmelden',
    language: 'Sprache',
    calendar: 'Kalender',
    login: 'Anmelden',
    email: 'E-Mail',
    username: 'Benutzername',
    password: 'Passwort',
    signIn: 'Anmelden',
    forgotPassword: 'Passwort vergessen?',
  },
}

export const LOCALE_OPTIONS: { value: FormLocale; label: string; short: string }[] = [
  { value: 'fa', label: 'فارسی', short: 'FA' },
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'de', label: 'Deutsch', short: 'DE' },
]
