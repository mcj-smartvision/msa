/**
 * Outbound email: Resend API and/or SMTP.
 * Set RESEND_API_KEY and/or SMTP_HOST (+ SMTP_USER/SMTP_PASS).
 * Optional ATTENDANCE_NOTIFY_EMAIL / EMAIL_FROM for From + security copy.
 */

export type SendEmailInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

export type SendEmailResult =
  | { ok: true; provider: 'resend' | 'smtp'; id?: string }
  | { ok: false; provider: 'none' | 'resend' | 'smtp'; error: string; skipped: boolean }

function normalizeRecipients(to: string | string[]): string[] {
  const list = (Array.isArray(to) ? to : [to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(list)].filter((e) => e.includes('@') && !e.endsWith('@site.local'))
}

export function getEmailRuntimeStatus() {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim())
  const hasSmtp = Boolean(process.env.SMTP_HOST?.trim())
  const notifyEmail = process.env.ATTENDANCE_NOTIFY_EMAIL?.trim() || null
  return {
    configured: hasResend || hasSmtp,
    providers: {
      resend: hasResend,
      smtp: hasSmtp,
    },
    notifyEmail,
    from:
      process.env.ATTENDANCE_EMAIL_FROM?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      (hasResend ? 'SitePilot <onboarding@resend.dev>' : notifyEmail),
    hint: hasResend || hasSmtp
      ? null
      : 'برای ارسال ایمیل RESEND_API_KEY یا SMTP_HOST را در .env.local بگذارید. یوزرهای @site.local ایمیل واقعی ندارند.',
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = normalizeRecipients(input.to)
  const status = getEmailRuntimeStatus()

  if (!status.configured) {
    return {
      ok: false,
      provider: 'none',
      skipped: true,
      error:
        'سرویس ایمیل پیکربندی نشده (RESEND_API_KEY یا SMTP_HOST). اعلان داخل‌سامانه ثبت شد.',
    }
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      provider: 'none',
      skipped: true,
      error:
        'آدرس ایمیل قابل ارسال نیست (خالی یا @site.local). برای کاربر ایمیل واقعی در پروفایل بگذارید یا ATTENDANCE_NOTIFY_EMAIL را تنظیم کنید.',
    }
  }

  const from = status.from || 'SitePilot <noreply@site.local>'
  const html =
    input.html ??
    `<pre style="font-family:Tahoma,sans-serif;white-space:pre-wrap">${escapeHtml(input.text)}</pre>`

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend({
      from,
      to: recipients,
      subject: input.subject,
      text: input.text,
      html,
      apiKey: process.env.RESEND_API_KEY.trim(),
    })
  }

  return sendViaSmtp({
    from,
    to: recipients,
    subject: input.subject,
    text: input.text,
    html,
  })
}

async function sendViaResend(input: {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  apiKey: string
}): Promise<SendEmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) {
      return {
        ok: false,
        provider: 'resend',
        skipped: false,
        error: body.message || `Resend HTTP ${res.status}`,
      }
    }
    return { ok: true, provider: 'resend', id: body.id }
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      skipped: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    }
  }
}

async function sendViaSmtp(input: {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
}): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) {
    return {
      ok: false,
      provider: 'none',
      skipped: true,
      error: 'SMTP_HOST not set',
    }
  }

  try {
    // Optional dependency — installed in package.json
    const nodemailer = await import('nodemailer')
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = process.env.SMTP_SECURE === 'true' || port === 465
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    })

    const info = await transporter.sendMail({
      from: input.from,
      to: input.to.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html,
    })

    return { ok: true, provider: 'smtp', id: info.messageId }
  } catch (err) {
    return {
      ok: false,
      provider: 'smtp',
      skipped: false,
      error: err instanceof Error ? err.message : 'SMTP send failed',
    }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
