export const QC_ACTIVITY_TYPES = [
  'welding',
  'bracing',
  'bolting',
  'steel_erection',
  'rebar',
  'formwork',
  'concrete_pour',
  'foundation',
  'excavation',
  'masonry',
  'decking',
  'facade',
  'waterproofing',
  'insulation',
  'plastering',
  'tiling',
  'painting',
  'flooring',
  'drywall',
  'false_ceiling',
  'doors_windows',
  'finishing',
  'electrical',
  'plumbing',
  'hvac',
  'fire_protection',
  'mechanical',
  'elevator',
  'roofing',
  'landscaping',
] as const

export type QcActivityType = (typeof QC_ACTIVITY_TYPES)[number]

export type QcActivityGroup = 'structure' | 'architecture' | 'mep' | 'site'

type ActivityMeta = {
  fa: string
  en: string
  group: QcActivityGroup
  pattern: RegExp
  checks: { code: string; prompt: string }[]
}

const genericChecks = (prefix: string, extra: string[] = []): { code: string; prompt: string }[] =>
  [
    'اجرا مطابق نقشه و مشخصات فنی است.',
    'مصالح و جزئیات اجرایی تأیید شده است.',
    'اتصالات، درزها و نقاط بحرانی بدون نقص مشهود است.',
    ...extra,
  ].map((prompt, index) => ({
    code: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    prompt,
  }))

export const QC_ACTIVITY_META: Record<QcActivityType, ActivityMeta> = {
  welding: {
    fa: 'بازرسی جوش',
    en: 'Welding inspection',
    group: 'structure',
    pattern: /جوش|بازرسی\s*جوش|welding|ndt|رادیوگرافی/i,
    checks: [
      { code: 'WD-01', prompt: 'آماده‌سازی لبه و فاصله ریشه صحیح است.' },
      { code: 'WD-02', prompt: 'الکترود و پارامتر جوش مطابق دستورکار است.' },
      { code: 'WD-03', prompt: 'ترک، تخلخل یا بریدگی لبه دیده نمی‌شود.' },
      { code: 'WD-04', prompt: 'تمیزکاری سرباره انجام شده است.' },
    ],
  },
  bracing: {
    fa: 'بادبندی',
    en: 'Bracing',
    group: 'structure',
    pattern: /بادبند|مهاربند|bracing/i,
    checks: genericChecks('BR', ['مهاربند در موقعیت و تراز نقشه است.']),
  },
  bolting: {
    fa: 'پیچ و مهره',
    en: 'Bolting',
    group: 'structure',
    pattern: /پیچ\s*و\s*مهره|بولت|bolting|high.?strength.?bolt/i,
    checks: genericChecks('BT', ['گشتاور سفت‌کردن پیچ مطابق دستورکار است.']),
  },
  steel_erection: {
    fa: 'اسکلت فلزی',
    en: 'Steel erection',
    group: 'structure',
    pattern: /اسکلت.?فلز|ساز[هۀ]?\s*فلزی|steel.?structur|نصب\s*تیر/i,
    checks: genericChecks('ST', ['شاقول، تراز و اتصال اعضا تأیید شده است.']),
  },
  rebar: {
    fa: 'آرماتوربندی',
    en: 'Rebar',
    group: 'structure',
    pattern: /آرماتور|میلگرد|rebar|آهن.?بند/i,
    checks: [
      { code: 'RB-01', prompt: 'قطر و تعداد میلگرد مطابق نقشه است.' },
      { code: 'RB-02', prompt: 'پوشش بتن (کاور) در محدوده مجاز است.' },
      { code: 'RB-03', prompt: 'طول اورلپ و قلاب‌ها صحیح است.' },
      { code: 'RB-04', prompt: 'سطح میلگرد تمیز و عاری از روغن و گل است.' },
    ],
  },
  formwork: {
    fa: 'قالب‌بندی',
    en: 'Formwork',
    group: 'structure',
    pattern: /قالب|formwork/i,
    checks: [
      { code: 'FW-01', prompt: 'تراز و امتداد قالب تأیید شده است.' },
      { code: 'FW-02', prompt: 'مهار و پشت‌بند قالب کافی است.' },
      { code: 'FW-03', prompt: 'داخل قالب تمیز و درزها آب‌بند است.' },
      { code: 'FW-04', prompt: 'ابعاد مقطع مطابق نقشه است.' },
    ],
  },
  concrete_pour: {
    fa: 'بتن‌ریزی',
    en: 'Concrete pour',
    group: 'structure',
    pattern: /بتن.?ریز|بتن ریزی|concrete/i,
    checks: [
      { code: 'CP-01', prompt: 'اسلامپ و دمای بتن در محدوده مجاز است.' },
      { code: 'CP-02', prompt: 'فاصله زمانی حمل تا ریختن رعایت شده است.' },
      { code: 'CP-03', prompt: 'ویبره به‌صورت یکنواخت انجام شده است.' },
      { code: 'CP-04', prompt: 'عمل‌آوری اولیه شروع شده است.' },
    ],
  },
  foundation: {
    fa: 'فونداسیون',
    en: 'Foundation',
    group: 'site',
    pattern: /فونداسیون|پی\s*ساختمان|پی\s*نواری|پی\s*گسترده|foundation/i,
    checks: genericChecks('FD', ['ابعاد، رقوم و آرماتور پی مطابق نقشه است.']),
  },
  excavation: {
    fa: 'خاکبرداری',
    en: 'Excavation',
    group: 'site',
    pattern: /خاکبردار|گودبردار|خاکریز|excavation/i,
    checks: genericChecks('EX', ['رقوم کف گود و پایدارسازی جداره تأیید شده است.']),
  },
  masonry: {
    fa: 'بنایی',
    en: 'Masonry',
    group: 'structure',
    pattern: /بنایی|آجرچینی|بلوک.?چینی|masonry/i,
    checks: [
      { code: 'MS-01', prompt: 'رج‌چینی شاقول و تراز است.' },
      { code: 'MS-02', prompt: 'ضخامت بند ملات یکنواخت است.' },
      { code: 'MS-03', prompt: 'همپوشانی آجر/بلوک صحیح است.' },
      { code: 'MS-04', prompt: 'مصالح خشک و تمیز است.' },
    ],
  },
  decking: {
    fa: 'عرشه فولادی',
    en: 'Metal deck',
    group: 'structure',
    pattern: /عرشه.?فولاد|متال.?دک|metal.?deck/i,
    checks: genericChecks('DK', ['گیره، اورلپ و مهار عرشه مطابق نقشه است.']),
  },
  facade: {
    fa: 'نما',
    en: 'Facade',
    group: 'architecture',
    pattern: /نماکاری|نمای\s|سنگ.?نما|آجر.?نما|سرامیک.?نما|کامپوزیت|ترمووود|facade|cladding|(?:بازرسی|اجرا|کار)\s*نما\b|(?:^|[^\u0600-\u06FF])نما(?:[^\u0600-\u06FF]|$)/i,
    checks: genericChecks('FC', ['زیرسازی، درزها و مهار نما ایمن و مطابق نقشه است.']),
  },
  waterproofing: {
    fa: 'آب‌بندی',
    en: 'Waterproofing',
    group: 'architecture',
    pattern: /آب.?بند|ایزوگام|قیرگونی|waterproof/i,
    checks: [
      { code: 'WP-01', prompt: 'سطح زیر کار تمیز و خشک است.' },
      { code: 'WP-02', prompt: 'همپوشانی لایه‌ها کافی است.' },
      { code: 'WP-03', prompt: 'جزئیات کنج و لوله عبور کرده آب‌بند است.' },
      { code: 'WP-04', prompt: 'آسیب‌دیدگی غشا مشاهده نمی‌شود.' },
    ],
  },
  insulation: {
    fa: 'عایق‌بندی',
    en: 'Insulation',
    group: 'architecture',
    pattern: /عایق.?بند|عایق.?حرارت|عایق.?صوت|پشم.?سنگ|پشم.?شیشه|insulation/i,
    checks: genericChecks('IN', ['ضخامت و پوشش عایق پیوسته و بدون پل حرارتی مشهود است.']),
  },
  plastering: {
    fa: 'گچ‌کاری',
    en: 'Plastering',
    group: 'architecture',
    pattern: /گچ.?کار|سفیدکار|plaster/i,
    checks: genericChecks('PL', ['تراز، شاقول و ترک‌خوردگی سطح کنترل شده است.']),
  },
  tiling: {
    fa: 'کاشی‌کاری',
    en: 'Tiling',
    group: 'architecture',
    pattern: /کاشی|سرامیک(?!.?نما)|tile/i,
    checks: genericChecks('TL', ['شیب، بندکشی و چسبندگی مصالح تأیید شده است.']),
  },
  painting: {
    fa: 'نقاشی',
    en: 'Painting',
    group: 'architecture',
    pattern: /نقاشی|رنگ.?آمی|painting/i,
    checks: genericChecks('PT', ['آماده‌سازی سطح و پوشش نهایی یکنواخت است.']),
  },
  flooring: {
    fa: 'کف‌سازی',
    en: 'Flooring',
    group: 'architecture',
    pattern: /کف.?ساز|کفپوش|موزاییک|epoxy|flooring/i,
    checks: genericChecks('FL', ['تراز، شیب و اتصال به دیوارها صحیح است.']),
  },
  drywall: {
    fa: 'دیوار خشک',
    en: 'Drywall',
    group: 'architecture',
    pattern: /دیوار.?خشک|کناف|drywall|gypsum.?board/i,
    checks: genericChecks('DW', ['زیرسازی، درزگیری و تراز صفحات تأیید شده است.']),
  },
  false_ceiling: {
    fa: 'سقف کاذب',
    en: 'False ceiling',
    group: 'architecture',
    pattern: /سقف.?کاذب|سقف.?کناف|false.?ceiling/i,
    checks: genericChecks('SC', ['آویز، تراز و بازشوهای تأسیسات مطابق نقشه است.']),
  },
  doors_windows: {
    fa: 'در و پنجره',
    en: 'Doors and windows',
    group: 'architecture',
    pattern: /پنجره|نصب.?در\b|درب\s*و\s*پنجره|آلومینیوم.?در|upvc|\bwindows?\b|\bdoors?\b/i,
    checks: genericChecks('DW2', ['ابعاد، یراق و آب‌بندی اطراف قاب تأیید شده است.']),
  },
  finishing: {
    fa: 'نازک‌کاری',
    en: 'Finishing',
    group: 'architecture',
    pattern: /نازک.?کار|نازککاری|finishing/i,
    checks: genericChecks('FN', ['کیفیت سطح تمام‌شده و جزئیات نازک‌کاری تأیید شده است.']),
  },
  electrical: {
    fa: 'برق',
    en: 'Electrical',
    group: 'mep',
    pattern: /برق|الکتریک|کابل.?کشی|سینی.?کابل|electr/i,
    checks: genericChecks('EL', ['مسیر، سایز کابل و اتصالات مطابق نقشه برق است.']),
  },
  plumbing: {
    fa: 'لوله‌کشی',
    en: 'Plumbing',
    group: 'mep',
    pattern: /لوله.?کشی|فاضلاب|آبرسانی|plumbing/i,
    checks: genericChecks('PB', ['شیب، اتصالات و تست فشار/آب‌بندی انجام شده است.']),
  },
  hvac: {
    fa: 'تهویه مطبوع',
    en: 'HVAC',
    group: 'mep',
    pattern: /تهویه|هواساز|کانال.?هوا|چیلر|hvac/i,
    checks: genericChecks('HV', ['کانال، عایق و تجهیزات در موقعیت نقشه است.']),
  },
  fire_protection: {
    fa: 'اطفا و اعلام حریق',
    en: 'Fire protection',
    group: 'mep',
    pattern: /اطفا|اطفاء|اعلام.?حریق|اسپرینکلر|fire.?protect/i,
    checks: genericChecks('FP', ['مسیر لوله، هد و تجهیزات اعلام/اطفا مطابق نقشه است.']),
  },
  mechanical: {
    fa: 'مکانیک',
    en: 'Mechanical',
    group: 'mep',
    pattern: /مکانیک|تاسیسات|تأسیسات|mechanical/i,
    checks: genericChecks('MC', ['نصب تجهیزات مکانیکی و مسیر لوله‌ها مطابق نقشه است.']),
  },
  elevator: {
    fa: 'آسانسور',
    en: 'Elevator',
    group: 'mep',
    pattern: /آسانسور|بالابر|elevator/i,
    checks: genericChecks('EV', ['چاه، ریل و تجهیزات ایمنی مطابق مشخصات است.']),
  },
  roofing: {
    fa: 'بام',
    en: 'Roofing',
    group: 'architecture',
    pattern: /خرپشته|شیروانی|roofing|ایزوگام.?بام|بازرسی\s*بام|کار\s*بام/i,
    checks: genericChecks('RF', ['شیب، عایق و جزئیات آبرو بام تأیید شده است.']),
  },
  landscaping: {
    fa: 'محوطه‌سازی',
    en: 'Landscaping',
    group: 'site',
    pattern: /محوطه.?ساز|فضای.?سبز|landscap/i,
    checks: genericChecks('LS', ['تراز، مصالح کف و جزئیات محوطه مطابق نقشه است.']),
  },
}

export const QC_ACTIVITY_GROUPS: { key: QcActivityGroup; fa: string; en: string }[] = [
  { key: 'structure', fa: 'سازه', en: 'Structure' },
  { key: 'architecture', fa: 'معماری و نازک‌کاری', en: 'Architecture & finishes' },
  { key: 'mep', fa: 'تأسیسات', en: 'MEP' },
  { key: 'site', fa: 'زیرسازی و محوطه', en: 'Sitework' },
]

export const QC_ACTIVITY_RULES: { key: QcActivityType; topic: string; pattern: RegExp }[] = QC_ACTIVITY_TYPES.map(
  (key) => ({
    key,
    topic: QC_ACTIVITY_META[key].fa,
    pattern: QC_ACTIVITY_META[key].pattern,
  })
)

export const QC_ACTIVITY_FA: Record<QcActivityType, string> = Object.fromEntries(
  QC_ACTIVITY_TYPES.map((key) => [key, QC_ACTIVITY_META[key].fa])
) as Record<QcActivityType, string>

export const QC_CHECKLIST_BY_ACTIVITY: Record<QcActivityType, { code: string; prompt: string }[]> =
  Object.fromEntries(QC_ACTIVITY_TYPES.map((key) => [key, QC_ACTIVITY_META[key].checks])) as Record<
    QcActivityType,
    { code: string; prompt: string }[]
  >

export function isQcActivityType(value: string): value is QcActivityType {
  return (QC_ACTIVITY_TYPES as readonly string[]).includes(value)
}

export function matchQcActivity(text: string): QcActivityType | null {
  for (const key of QC_ACTIVITY_TYPES) {
    const pattern = QC_ACTIVITY_META[key].pattern
    pattern.lastIndex = 0
    if (pattern.test(text)) return key
  }
  return null
}

export function qcActivityLabel(type: string, locale?: string) {
  if (!isQcActivityType(type)) return type
  const persian = locale !== 'en' && locale !== 'de' && locale !== 'fr'
  return persian ? QC_ACTIVITY_META[type].fa : QC_ACTIVITY_META[type].en
}

export function qcActivityGroupLabel(group: QcActivityGroup, locale?: string) {
  const row = QC_ACTIVITY_GROUPS.find((item) => item.key === group)
  if (!row) return group
  const persian = locale !== 'en' && locale !== 'de' && locale !== 'fr'
  return persian ? row.fa : row.en
}

export function qcActivitiesByGroup() {
  return QC_ACTIVITY_GROUPS.map((group) => ({
    group: group.key,
    types: QC_ACTIVITY_TYPES.filter((key) => QC_ACTIVITY_META[key].group === group.key),
  }))
}

export function qcActivityAiGuide() {
  return QC_ACTIVITY_TYPES.map((key) => `${key} = ${QC_ACTIVITY_META[key].fa}`).join('\n')
}
