import type { ReactNode } from 'react'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import { PPC_LOW, type WeeklyCommitmentsData } from '@/features/manager/lib/weekly-commitments'

/** Live numbers the help panels quote; null when that number is not available yet. */
export interface HelpContext {
  ppcData: WeeklyCommitmentsData | null
  ppcMissing: string | null
  spi: number | null
  spiT: number | null
  evPct: number | null
  pvPct: number | null
  es: number | null
  at: number | null
  unitFa: string
}

/** Percent with up to `digits` decimals; whole numbers print without a fraction. */
export function pct(v: number, digits = 0): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits
  return `${faNumber(r, Number.isInteger(r) ? 0 : digits)}٪`
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-bold text-[#1e2a5e]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

/** Label/value lines of the card's current numbers; rows without a value are skipped. */
function HelpNumbers({ rows }: { rows: Array<[string, string | null]> }) {
  const shown = rows.filter((r): r is [string, string] => r[1] != null)
  if (shown.length === 0) return <p className="text-slate-500">هنوز عددی برای نمایش نیست.</p>
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-[#faf9f7]">
      {shown.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 px-3 py-1.5">
          <dt className="text-slate-600">{label}</dt>
          <dd className="text-left font-bold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-100 px-3 py-1.5 text-center font-bold text-slate-800">{children}</p>
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 ps-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** The scoring rule of phase one, shared by the PPC, trend and commitments panels. */
function PhaseOneRule() {
  return (
    <HelpSection title="فعلاً (فاز اول) چطور حساب می‌شود؟">
      <p>
        در روش اصلی، سرپرست‌ها هر هفته خودشان قول می‌دهند چه کارهایی را انجام دهند. تا وقتی ورود این «برنامهٔ تعهدات هفتگی» ساخته نشده، تعهدات
        هر هفته را <b>همان برنامهٔ زمان‌بندی</b> در نظر می‌گیریم؛ یعنی فرض می‌کنیم کارگاه متعهد است دقیقاً طبق برنامه جلو برود.
      </p>
      <Bullets
        items={[
          <>
            <b>هفته:</b> شنبه تا پنج‌شنبه (جمعه تعطیل است). مهلت هر هفته پایان روز پنج‌شنبه است.
          </>,
          <>
            <b>تعهدات هفته:</b> هر فعالیت برنامهٔ زمان‌بندی که بازهٔ برنامه‌ای‌اش (از تاریخ شروع تا پایان در <b>آخرین نسخهٔ برنامه</b>) با آن هفته هم‌پوشانی دارد. زیرشاخه‌های
            کارگاهی که درصدشان در گزارش روزانه جداگانه ثبت می‌شود هم هر کدام یک تعهد جدا هستند؛ یعنی همان فهرستی که سرپرست در «ثبت گزارش روزانه» می‌بیند.
          </>,
          <>
            <b>بازهٔ پیش‌بینی‌شده:</b> آخرین نسخهٔ برنامه با هر گزارش روزانه خودبه‌خود جابه‌جا می‌شود (پیش‌بینی بر اساس پیشرفت واقعی؛ پایین را ببینید). درصد لازم
            هر هفته با بازهٔ فعالیت طبق پیش‌بینیِ روز پنج‌شنبه (برای هفتهٔ جاری: امروز) حساب می‌شود؛ یعنی اگر پیش‌نیاز زودتر تمام شود، فعالیت بعدی همان لحظه جلو
            می‌آید و اگر دیر شود همان لحظه عقب می‌رود. پیش‌بینی هر روز فقط از گزارش‌های قبل از آن روز ساخته می‌شود.
          </>,
          <>
            <b>درصد لازم تا پنج‌شنبه:</b> پیشرفت برنامه‌ای به‌صورت خطی و بر اساس روز تقویمی (مثل منحنی S و ارزش کسب‌شده) پخش می‌شود:
            <Formula>درصد لازم = (تعداد روز از شروع فعالیت تا پنج‌شنبه ÷ کل روزهای فعالیت) × ۱۰۰</Formula>
            هر دو سر بازه حساب می‌شوند. اگر فعالیت قبل از پنج‌شنبه تمام شود، درصد لازم ۱۰۰٪ است.
          </>,
          <>
            <b>درصد واقعی:</b> آخرین درصد تجمعی که سرپرست تا پایان پنج‌شنبه برای آن فعالیت ثبت کرده است. گزارشی که بعد از پنج‌شنبه ثبت شود، در نمرهٔ همان هفته
            حساب نمی‌شود. فعالیتی که هیچ‌وقت گزارش نشده، درصد ذخیره‌شده در برنامه را دارد (مثلاً درصدی که از MSP وارد شده).
          </>,
          <>
            <b>نمره:</b> اگر درصد واقعی برابر یا بیشتر از درصد لازم باشد، فعالیت نمره می‌گیرد؛ وگرنه نه. نمرهٔ نسبی نداریم: ۴۹٪ در برابر ۵۰٪ یعنی «انجام‌نشده».
          </>,
          <>
            <b>وزن:</b> همهٔ فعالیت‌ها یک نمره دارند، چه بزرگ باشند چه کوچک. PPC «قابلیت اعتماد به قول‌ها» را می‌سنجد، نه حجم کار؛ حجم کار را SPI می‌سنجد.
          </>,
          <>
            <b>هفتهٔ جاری:</b> تا پنج‌شنبه هنوز بسته نشده؛ عددش «تا این لحظه» است و با پیشرفت امروز حساب می‌شود، پس ممکن است تا پنج‌شنبه بالا برود.
          </>,
        ]}
      />
      <Formula>PPC = تعداد فعالیت‌های نمره‌گرفته ÷ تعداد کل فعالیت‌های برنامهٔ هفته × ۱۰۰</Formula>
    </HelpSection>
  )
}

function DataSources() {
  return (
    <HelpSection title="داده از کجا می‌آید؟">
      <Bullets
        items={[
          'تاریخ‌های برنامه: بازهٔ پیش‌بینی‌شدهٔ هر فعالیت از آخرین نسخهٔ برنامهٔ زمان‌بندی پروژه و زیرشاخه‌های کارگاهی دفتر فنی. SPI و منحنی S برخلاف PPC با برنامهٔ مبنا مقایسه می‌کنند.',
          'پیش‌بینی خودکار: بعد از هر ثبت گزارش روزانه، فعالیت‌های تمام‌شده تاریخ واقعی می‌گیرند؛ فعالیت در حال اجرا باقی کارش را از امروز با سرعت برنامه انجام می‌دهد (مدت فعالیت × (۱ − درصد انجام‌شده))؛ و فعالیت‌های شروع‌نشده از طریق پیش‌نیازها (FS/SS/FF/SF با تأخیرها) جلو یا عقب می‌روند. برنامهٔ مصوب دفتر فنی و برنامهٔ مبنا دست نمی‌خورند.',
          'درصدهای واقعی: گزارش روزانهٔ سرپرست کارگاه («ثبت گزارش روزانه» و «بک‌گراند گزارش‌های روزانه» در داشبورد سرپرست).',
          'برای درست‌شدن عدد، سرپرست باید درصد تجمعی فعالیت‌ها را تا پایان پنج‌شنبه ثبت کند؛ گزارش دیرهنگام به نفع هفتهٔ بعد حساب می‌شود.',
        ]}
      />
    </HelpSection>
  )
}

export function PpcHelp({ ctx }: { ctx: HelpContext }) {
  const d = ctx.ppcData
  const cur = d?.current ?? null
  const behind = cur?.commitments.filter((c) => !c.completed) ?? []
  const example = behind.find((c) => c.targetPercent != null) ?? cur?.commitments.find((c) => c.targetPercent != null) ?? null
  return (
    <>
      <HelpSection title="این شاخص چیست؟">
        <p>
          PPC (Percent Plan Complete، «درصد تحقق برنامه») شاخص اصلی روش <b>آخرین برنامه‌ریز</b> (Last Planner System) در مدیریت ناب ساخت است. می‌گوید از کارهایی که
          برای یک هفته قول داده شده بود، چند درصد واقعاً به موقع انجام شد.
        </p>
      </HelpSection>
      <HelpSection title="به چه دردی می‌خورد؟">
        <Bullets
          items={[
            <>
              <b>شاخص پیشرو است:</b> SPI و SPI(t) می‌گویند پروژه تا امروز چقدر عقب افتاده (نگاه به گذشته). PPC زودتر خبر می‌دهد: اگر چند هفته پشت سر هم پایین باشد،
              چند هفته بعد SPI هم پایین می‌آید.
            </>,
            'قابلیت اعتماد برنامه‌ریزی را نشان می‌دهد: وقتی PPC بالاست، کارهای بعدی (مصالح، اکیپ، پیمانکار بعدی) را می‌شود با اطمینان برنامه‌ریزی کرد.',
            'جای مشکل را نشان می‌دهد: فهرست فعالیت‌های عقب‌مانده دقیقاً می‌گوید این هفته کجا قول عملی نشد.',
          ]}
        />
      </HelpSection>
      <PhaseOneRule />
      <HelpSection title="عددهای الان">
        {d && cur ? (
          <HelpNumbers
            rows={[
              ['هفته', `${cur.live ? 'هفتهٔ جاری' : `هفتهٔ ${faNumber(cur.weekNumber)}`} (${jalaliDate(cur.start)} تا ${jalaliDate(cur.end)})`],
              ['وضعیت هفته', cur.live ? 'باز است؛ عدد تا این لحظه است' : 'بسته شده؛ عدد نهایی است'],
              ['تعداد تعهدات (فعالیت‌های برنامهٔ هفته)', faNumber(cur.planned)],
              ['به درصد برنامه رسیده‌اند', faNumber(cur.completed)],
              ['عقب از برنامه', faNumber(cur.planned - cur.completed)],
              ['PPC', cur.ppc == null ? null : `${faNumber(cur.completed)} ÷ ${faNumber(cur.planned)} = ${pct(cur.ppc)}`],
              ['PPC هفتهٔ قبل', d.previousPpc == null ? null : pct(d.previousPpc)],
              [`میانگین ${faNumber(d.rnc.weeks)} هفتهٔ بسته‌شدهٔ اخیر`, d.average4 == null ? null : pct(d.average4)],
              ['هدف', pct(d.target)],
            ]}
          />
        ) : (
          <p className="text-slate-500">{ctx.ppcMissing ?? 'هنوز داده‌ای نیست.'}</p>
        )}
        {example && example.targetPercent != null && example.actualPercent != null ? (
          <p>
            <b>مثال از همین هفته:</b> «{example.description}» طبق برنامه باید تا پایان پنج‌شنبه به {pct(example.targetPercent, 1)} برسد و درصد ثبت‌شده‌اش{' '}
            {pct(example.actualPercent, 1)} است؛ پس {example.completed ? 'نمره می‌گیرد' : 'نمره نمی‌گیرد'}.
          </p>
        ) : null}
      </HelpSection>
      <HelpSection title="رنگ‌ها چه می‌گویند؟">
        <Bullets
          items={[
            `سبز («در هدف»): ${pct(d?.target ?? 80)} یا بیشتر؛ برنامه‌ریزی قابل اعتماد است.`,
            `زرد («زیر هدف»): بین ${pct(PPC_LOW)} و ${pct(d?.target ?? 80)}؛ باید علت عقب‌ماندن فعالیت‌ها بررسی شود.`,
            `قرمز («پایین»): کمتر از ${pct(PPC_LOW)}؛ برنامه با واقعیت کارگاه فاصله دارد و برنامهٔ هفته‌های بعد هم قابل اتکا نیست.`,
          ]}
        />
      </HelpSection>
      <DataSources />
      <HelpSection title="محدودیت‌های فاز اول و فاز بعد">
        <Bullets
          items={[
            'تعهدات از برنامه می‌آیند، نه از قول خود کارگاه؛ پس PPC فعلاً بیشتر «پایبندی به برنامهٔ زمان‌بندی» را نشان می‌دهد.',
            'علت عدم تحقق (مصالح، اکیپ، نقشه، …) هنوز ثبت نمی‌شود، برای همین کادر «علل ریشه‌ای» خالی است.',
            'در فاز بعد، سرپرست‌ها هر هفته فهرست تعهدات خودشان را وارد می‌کنند (فقط کارهایی که آماده و بدون قفل‌اند)، و برای هر کار انجام‌نشده علت ثبت می‌شود.',
          ]}
        />
      </HelpSection>
    </>
  )
}

export function SpiHelp({ ctx }: { ctx: HelpContext }) {
  return (
    <>
      <HelpSection title="این شاخص چیست؟">
        <p>
          SPI (Schedule Performance Index، «شاخص عملکرد زمانی») از روش <b>مدیریت ارزش کسب‌شده</b> (EVM) است. مقایسه می‌کند تا امروز چقدر کار واقعاً انجام شده با
          اینکه طبق برنامهٔ مبنا تا امروز چقدر باید انجام می‌شد.
        </p>
        <Formula>SPI = EV ÷ PV</Formula>
        <Bullets
          items={[
            'EV (ارزش کسب‌شده): مجموع وزنی درصد واقعی همهٔ فعالیت‌ها؛ یعنی چند درصد کل پروژه واقعاً انجام شده.',
            'PV (ارزش برنامه‌شده): مجموع وزنی درصدی که طبق برنامهٔ مبنا تا امروز باید انجام می‌شد.',
            'وزن هر فعالیت همان وزن آن در برنامهٔ زمان‌بندی است.',
          ]}
        />
      </HelpSection>
      <HelpSection title="به چه دردی می‌خورد؟">
        <p>
          می‌گوید پروژه از نظر <b>حجم کار</b> چقدر جلو یا عقب است. SPI = ۱ یعنی دقیقاً طبق برنامه؛ ۰٫۸۷ یعنی از هر ۱۰۰ واحد کاری که باید انجام می‌شد، ۸۷ واحد انجام
          شده؛ بیشتر از ۱ یعنی جلوتر از برنامه.
        </p>
      </HelpSection>
      <HelpSection title="عددهای الان">
        <HelpNumbers
          rows={[
            ['EV (کار انجام‌شده از کل پروژه)', ctx.evPct == null ? null : pct(ctx.evPct, 1)],
            ['PV (کار برنامه‌شده تا امروز)', ctx.pvPct == null ? null : pct(ctx.pvPct, 1)],
            [
              'SPI',
              ctx.spi == null
                ? null
                : ctx.evPct != null && ctx.pvPct != null
                  ? `${faNumber(ctx.evPct, 1)} ÷ ${faNumber(ctx.pvPct, 1)} = ${faNumber(ctx.spi, 2)}`
                  : faNumber(ctx.spi, 2),
            ],
            ['یعنی', ctx.spi == null ? null : `از هر ۱۰۰ واحد کار برنامه‌شده، ${faNumber(Math.round(ctx.spi * 100))} واحد انجام شده`],
          ]}
        />
      </HelpSection>
      <HelpSection title="رنگ‌ها">
        <Bullets items={['سبز: ۱ یا بیشتر (طبق برنامه یا جلوتر).', 'زرد: ۰٫۹ تا ۱ (کمی عقب).', 'قرمز: کمتر از ۰٫۹ (عقب از برنامه).']} />
      </HelpSection>
      <HelpSection title="یک نکتهٔ مهم">
        <p>
          نزدیک پایان پروژه SPI همیشه به ۱ میل می‌کند، حتی اگر پروژه دیر تمام شود؛ چون در پایان، هم کار انجام‌شده و هم کار برنامه‌شده ۱۰۰٪ می‌شوند. برای همین در
          ماه‌های آخر به SPI(t) بیشتر اعتماد کنید. نمودار کوچک پایین کارت روند SPI را از نقاط ثبت‌شدهٔ منحنی S تا امروز نشان می‌دهد.
        </p>
      </HelpSection>
    </>
  )
}

export function SpiTHelp({ ctx }: { ctx: HelpContext }) {
  const u = ctx.unitFa
  return (
    <>
      <HelpSection title="این شاخص چیست؟">
        <p>
          SPI(t) نسخهٔ «زمانی» شاخص عملکرد زمانی است و از روش <b>زمان کسب‌شده</b> (Earned Schedule) می‌آید. به جای حجم کار، با <b>زمان</b> حساب می‌کند.
        </p>
        <Formula>SPI(t) = ES ÷ AT</Formula>
        <Bullets
          items={[
            `ES (زمان کسب‌شده): پیشرفتی که الان داریم، طبق برنامهٔ مبنا باید در کدام ${u} از شروع پروژه به دست می‌آمد.`,
            `AT (زمان واقعی): چند ${u} از شروع پروژه واقعاً گذشته است.`,
          ]}
        />
      </HelpSection>
      <HelpSection title="به چه دردی می‌خورد؟">
        <p>
          مستقیم می‌گوید پروژه چند {u} عقب یا جلو است و برخلاف SPI تا آخر پروژه قابل اعتماد می‌ماند. با آن می‌شود تاریخ پایان را هم پیش‌بینی کرد: اگر همین روند ادامه
          پیدا کند، مدت پروژه تقریباً برابر «مدت برنامه ÷ SPI(t)» می‌شود.
        </p>
      </HelpSection>
      <HelpSection title="عددهای الان">
        <HelpNumbers
          rows={[
            [`ES (پیشرفت فعلی معادل کدام ${u} برنامه است)`, ctx.es == null ? null : `${u} ${faNumber(ctx.es, 1)}`],
            [`AT (${u}های گذشته از شروع)`, ctx.at == null ? null : `${faNumber(ctx.at, 1)} ${u}`],
            [
              'SPI(t)',
              ctx.spiT == null
                ? null
                : ctx.es != null && ctx.at != null
                  ? `${faNumber(ctx.es, 1)} ÷ ${faNumber(ctx.at, 1)} = ${faNumber(ctx.spiT, 2)}`
                  : faNumber(ctx.spiT, 2),
            ],
            [
              'فاصله با برنامه',
              ctx.es != null && ctx.at != null
                ? ctx.at > ctx.es
                  ? `حدود ${faNumber(ctx.at - ctx.es, 1)} ${u} عقب‌تر از برنامه`
                  : 'هم‌پای برنامه یا جلوتر'
                : null,
            ],
          ]}
        />
      </HelpSection>
      <HelpSection title="رنگ‌ها">
        <Bullets items={['سبز: ۱ یا بیشتر.', 'زرد: ۰٫۹ تا ۱.', 'قرمز: کمتر از ۰٫۹.']} />
      </HelpSection>
      <HelpSection title="SPI و SPI(t) را چطور کنار هم بخوانیم؟">
        <p>
          SPI حجم کار را می‌سنجد و SPI(t) زمان را. اگر از هم فاصله بگیرند، به SPI(t) بیشتر اعتماد کنید. PPC هم کنارشان می‌گوید «چرا»: اگر PPC چند هفته پایین باشد،
          یعنی قول‌های هفتگی عملی نمی‌شوند و SPI و SPI(t) هم به‌زودی پایین می‌آیند.
        </p>
      </HelpSection>
    </>
  )
}

export function LocksHelp() {
  return (
    <>
      <HelpSection title="قفل (محدودیت) چیست؟">
        <p>
          در روش آخرین برنامه‌ریز، «قفل» هر چیزی است که اجازه نمی‌دهد یک کار شروع شود: مصالح نرسیده، نقشه یا اطلاعات فنی ناقص، اکیپ آزاد نیست، تجهیزات نیست، مجوز
          یا تأیید گرفته نشده، یا کار پیش‌نیاز تمام نشده. کاری «آماده» است که همهٔ قفل‌هایش باز شده باشد.
        </p>
      </HelpSection>
      <HelpSection title="به چه دردی می‌خورد؟">
        <p>
          اگر قفل‌های چند هفتهٔ آینده (Look-ahead) از الان دیده و باز شوند، کارها سر وقت آماده‌اند و PPC بالا می‌ماند. شمردن قفل‌ها بر اساس نوعشان نشان می‌دهد
          کدام واحد (تدارکات، دفتر فنی، منابع انسانی، …) باید زودتر اقدام کند.
        </p>
      </HelpSection>
      <HelpSection title="وضعیت فعلی">
        <p>
          ثبت قفل‌ها هنوز در سامانه ساخته نشده؛ برای همین این کادر عددی ندارد. وقتی ساخته شود، برای هر فعالیت هفته‌های آینده نوع قفل، تاریخ رفع مورد انتظار، وضعیت
          و اثر آن روی مسیر بحرانی ثبت می‌شود و این کادر تعداد کارهای قفل‌شده را نشان می‌دهد.
        </p>
      </HelpSection>
    </>
  )
}

export function TrendHelp({ ctx }: { ctx: HelpContext }) {
  const d = ctx.ppcData
  return (
    <>
      <HelpSection title="این نمودار چه نشان می‌دهد؟">
        <p>
          هر ستون PPC یک هفته است. ستون‌های پررنگ هفته‌های بسته‌شده‌اند (عدد نهایی). ستون کم‌رنگ و خط‌چین هفتهٔ جاری است که هنوز به پنج‌شنبه نرسیده و عددش تا این
          لحظه است. خط‌چین افقی هدف ({pct(d?.target ?? 80)}) است. حداکثر ۱۰ هفتهٔ بسته‌شدهٔ اخیر نشان داده می‌شود.
        </p>
        <p>
          روند مهم‌تر از یک هفته است: یک هفتهٔ بد ممکن است اتفاقی باشد، ولی چند هفته زیر هدف یعنی برنامه با واقعیت کارگاه فاصله دارد.
        </p>
      </HelpSection>
      <PhaseOneRule />
      <HelpSection title="عددهای هر هفته">
        {d && d.weeks.length ? (
          <HelpNumbers
            rows={d.weeks.map((w) => [
              `${w.live ? 'هفتهٔ جاری' : `هفتهٔ ${faNumber(w.weekNumber)}`} (${jalaliDate(w.start)} تا ${jalaliDate(w.end)})`,
              `${faNumber(w.completed)} از ${faNumber(w.planned)} · ${w.ppc == null ? '—' : pct(w.ppc)}`,
            ])}
          />
        ) : (
          <p className="text-slate-500">{ctx.ppcMissing ?? 'هنوز هفته‌ای نیست.'}</p>
        )}
      </HelpSection>
    </>
  )
}

export function CommitmentsHelp({ ctx }: { ctx: HelpContext }) {
  const cur = ctx.ppcData?.current ?? null
  return (
    <>
      <HelpSection title="این کادر چه نشان می‌دهد؟">
        <p>
          فهرست همهٔ فعالیت‌هایی که طبق برنامه در {cur?.live ? 'هفتهٔ جاری' : 'آخرین هفتهٔ بسته‌شده'} باید پیشرفت می‌کردند. هر کادر یک فعالیت است:
        </p>
        <Bullets
          items={[
            <>
              <b>سبز با تیک:</b> درصد ثبت‌شده به درصد لازم تا پنج‌شنبه رسیده (نمره گرفته). عدد کنارش «درصد ثبت‌شده / درصد لازم» است.
            </>,
            <>
              <b>قرمز:</b> هنوز به درصد برنامه نرسیده. نوشتهٔ «X٪ از Y٪ برنامه» یعنی درصد ثبت‌شده X است و برنامه تا پنج‌شنبه Y می‌خواهد. نوار قرمز نشان می‌دهد چه سهمی از
              درصد لازم انجام شده.
            </>,
            'عقب‌مانده‌ها اول آمده‌اند و هر چه عقب‌تر، بالاتر؛ پس اولین کادرها همان جاهایی‌اند که باید پیگیری شوند.',
          ]}
        />
        {cur ? (
          <p>
            الان {faNumber(cur.planned)} فعالیت در این هفته هست؛ {faNumber(cur.completed)} فعالیت به درصد برنامه رسیده و {faNumber(cur.planned - cur.completed)} فعالیت
            عقب است.
          </p>
        ) : null}
      </HelpSection>
      <PhaseOneRule />
      <DataSources />
    </>
  )
}

export function RncHelp() {
  return (
    <>
      <HelpSection title="این کادر چیست؟">
        <p>
          RNC (Reasons for Non-Completion، «علل عدم تحقق») برای هر کاری که در هفته انجام نشده یک علت ریشه‌ای ثبت می‌کند: مصالح، اکیپ، تجهیزات، مجوز و تأیید، نقشه و
          اطلاعات فنی، کار پیش‌نیاز، آب‌وهوا، دسترسی به کارگاه، پرداخت، دوباره‌کاری کیفی یا سایر. نمودار دایره‌ای سهم هر علت را در ۴ هفتهٔ اخیر نشان می‌دهد.
        </p>
      </HelpSection>
      <HelpSection title="به چه دردی می‌خورد؟">
        <p>
          معمولاً بیشتر کارهای انجام‌نشده از دو سه علت تکراری می‌آیند. با دیدن آن‌ها مدیر می‌داند اول کدام مشکل را حل کند تا PPC بالا برود.
        </p>
      </HelpSection>
      <HelpSection title="وضعیت فعلی">
        <p>
          در فاز اول تعهدات از برنامهٔ زمان‌بندی می‌آیند و هنوز جایی برای ثبت علت عدم تحقق نیست؛ برای همین این کادر خالی است. ثبت علت همراه با ورود برنامهٔ تعهدات
          هفتگی در فاز بعد اضافه می‌شود.
        </p>
      </HelpSection>
    </>
  )
}
