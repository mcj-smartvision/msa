/** Freeform enroll session + labels for stored auto samples. */

export const ENROLL_SESSION_MS = 30_000
export const ENROLL_MIN_DIVERSITY = 0.08
export const ENROLL_CAPTURE_EVERY_MS = 280
export const ENROLL_MIN_SAMPLES = 5
export const ENROLL_MAX_SAMPLES = 10

export const ENROLL_LIVE_TIPS_FA = [
  'مستقیم به دوربین نگاه کن',
  'سر را آرام به چپ و راست بچرخان',
  'چانه را کمی بالا و پایین بیاور',
  'کمی نزدیک‌تر یا عقب‌تر شو — صورت در قاب بماند',
  'اگر عینک داری، چند ثانیه بدون عینک هم بمان',
]

export function poseLabel(poseId: string, fa = true): string {
  if (poseId.startsWith('auto')) {
    const n = poseId.replace(/\D/g, '') || ''
    return fa ? `نمونه خودکار${n ? ` ${n}` : ''}` : `Auto sample${n ? ` ${n}` : ''}`
  }
  const map: Record<string, { fa: string; en: string }> = {
    straight: { fa: 'مستقیم', en: 'Straight' },
    tilt_up: { fa: 'بالا', en: 'Tilt up' },
    tilt_down: { fa: 'پایین', en: 'Tilt down' },
    turn_right: { fa: 'راست', en: 'Turn right' },
    turn_left: { fa: 'چپ', en: 'Turn left' },
    no_glasses: { fa: 'بدون عینک', en: 'No glasses' },
    scan: { fa: 'اسکن زنده', en: 'Live scan' },
  }
  const hit = map[poseId]
  if (!hit) return poseId
  return fa ? hit.fa : hit.en
}
