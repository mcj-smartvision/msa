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
  fr: {
    reports: 'Rapports',
    newReport: 'Nouveau rapport',
    admin: 'Administration',
    settings: 'Paramètres',
    signOut: 'Déconnexion',
    language: 'Langue',
    calendar: 'Calendrier',
    login: 'Connexion',
    email: 'E-mail',
    username: "Nom d'utilisateur",
    password: 'Mot de passe',
    signIn: 'Se connecter',
    forgotPassword: 'Mot de passe oublié ?',
  },
  ar: {
    reports: 'التقارير',
    newReport: 'تقرير جديد',
    admin: 'الإدارة',
    settings: 'الإعدادات',
    signOut: 'تسجيل الخروج',
    language: 'اللغة',
    calendar: 'التقويم',
    login: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    signIn: 'دخول',
    forgotPassword: 'نسيت كلمة المرور؟',
  },
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
}

export const LOCALE_OPTIONS: { value: FormLocale; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'de', label: 'Deutsch', short: 'DE' },
  { value: 'fr', label: 'Français', short: 'FR' },
  { value: 'ar', label: 'العربية', short: 'AR' },
  { value: 'fa', label: 'فارسی', short: 'FA' },
]
