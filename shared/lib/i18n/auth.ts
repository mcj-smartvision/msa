/**
 * @file shared/lib/i18n/auth.ts
 * @purpose متن صفحات ورود و خطای احراز هویت
 * @safe-to-edit YES
 * @affects /login و جریان post-login
 * @depends-on nothing
 */

export const AUTH_COPY = {
  subtitle: 'برای ادامه، اطلاعات ورود خود را وارد کنید.',
  identifierPlaceholder: 'ایمیل یا نام کاربری',
  networkError: 'ارتباط با سرور برقرار نشد. اینترنت/VPN را بررسی کنید، صفحه را رفرش کنید و دوباره وارد شوید.',
  badCredentials: 'ایمیل یا رمز عبور نادرست است.',
  incomplete: 'ورود ناقص ماند. صفحه را رفرش کنید و دوباره تلاش کنید.',
  failed: 'ورود انجام نشد. صفحه را رفرش کنید و دوباره تلاش کنید.',
  signingIn: 'در حال ورود...',
  inviteOnly: 'ورود فقط با دعوت‌نامه.',
  forgot: {
    title: 'فراموشی رمز عبور',
    hint: 'ایمیل خود را وارد کنید تا لینک بازنشانی دریافت کنید.',
    email: 'ایمیل',
    sending: 'در حال ارسال...',
    send: 'ارسال لینک بازنشانی',
    sent: 'اگر این ایمیل وجود داشته باشد، لینک بازنشانی رمز ارسال شده است.',
    backToLogin: 'بازگشت به ورود',
  },
  reset: {
    title: 'تنظیم رمز جدید',
    hint: 'برای حساب خود یک رمز جدید انتخاب کنید.',
    save: 'ذخیره رمز جدید',
  },
  minPasswordLength: 6,
  firstLogin: {
    title: 'حساب خود را امن کنید',
    hint: 'ادمین حساب شما را ساخته است. قبل از ادامه، یک رمز شخصی تنظیم کنید.',
    newPassword: 'رمز جدید',
    confirmPassword: 'تأیید رمز',
    placeholderMin: 'حداقل 6 کاراکتر',
    placeholderRepeat: 'رمز را دوباره وارد کنید',
    passwordShort: 'رمز عبور باید حداقل 6 کاراکتر باشد.',
    mismatch: 'رمزها یکسان نیستند.',
    sessionExpired: 'نشست منقضی شده است. لطفاً دوباره وارد شوید.',
    continue: 'ادامه به داشبورد',
    footer: 'MSA · امنیت اولین ورود',
  },
} as const
