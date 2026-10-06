import { CONSTRUCTION_STANDARDS } from '../../standards-catalog'
import type { FormDictionary } from '../types'

function translateStandardFa(label: string): string {
  return label
    .replace('Occupational Health & Safety', 'ایمنی و بهداشت شغلی')
    .replace('Quality Management', 'مدیریت کیفیت')
    .replace('Environmental Management', 'مدیریت محیط زیست')
    .replace('Energy Management', 'مدیریت انرژی')
    .replace('BIM / Information Management', 'مدیریت اطلاعات BIM')
    .replace('Open BIM Data Model', 'مدل داده باز BIM')
    .replace('Construction Safety', 'ایمنی ساخت و ساز')
    .replace('General Industry', 'صنعت عمومی')
    .replace('Occupational Safety Guidelines', 'راهنمای ایمنی شغلی')
    .replace('OHS Management Systems', 'سیستم های مدیریت ایمنی و بهداشت شغلی')
    .replace('Electrical Safety in Workplace', 'ایمنی برق در محیط کار')
    .replace('Life Safety Code', 'کد ایمنی جان')
    .replace('Mine Safety (when applicable)', 'ایمنی معدن (در صورت کاربرد)')
    .replace('International Building Code', 'کد بین المللی ساختمان')
    .replace('International Residential Code', 'کد بین المللی ساختمان های مسکونی')
    .replace('International Energy Conservation Code', 'کد بین المللی صرفه جویی انرژی')
    .replace('International Mechanical Code', 'کد بین المللی تاسیسات مکانیکی')
    .replace('International Plumbing Code', 'کد بین المللی لوله کشی')
    .replace('International Fire Code', 'کد بین المللی حریق')
    .replace('American Society for Testing & Materials', 'انجمن آمریکایی آزمون و مواد')
    .replace('Structural Concrete', 'بتن سازه ای')
    .replace('Structural Steel Buildings', 'ساختمان های فولادی سازه ای')
    .replace('Minimum Design Loads', 'حداقل بارهای طراحی')
    .replace('Highway & Bridge Design', 'طراحی راه و پل')
    .replace('National Electrical Safety Code', 'کد ملی ایمنی برق')
    .replace('Product Safety Certification', 'گواهی ایمنی محصول')
    .replace('Environmental Protection', 'حفاظت محیط زیست')
    .replace('Green Building Certification', 'گواهی ساختمان سبز')
    .replace('WELL Building Standard', 'استاندارد WELL ساختمان')
    .replace('Energy Standard for Buildings', 'استاندارد انرژی برای ساختمان ها')
    .replace('Hazardous Sites', 'سایت های آلوده و خطرناک')
    .replace('OHS Management', 'مدیریت ایمنی و بهداشت شغلی')
    .replace('OHS Training', 'آموزش ایمنی و بهداشت شغلی')
    .replace('Canadian Centre for OHS', 'مرکز کانادایی ایمنی و بهداشت شغلی')
    .replace('Act Respecting OHS', 'قانون ایمنی و بهداشت شغلی')
    .replace('National Building Code of Canada', 'کد ملی ساختمان کانادا')
    .replace('National Fire Code of Canada', 'کد ملی حریق کانادا')
    .replace('National Plumbing Code of Canada', 'کد ملی لوله کشی کانادا')
    .replace('Concrete Materials & Construction', 'مصالح و اجرای بتن')
    .replace('Design of Steel Structures', 'طراحی سازه های فولادی')
    .replace('Engineering Design in Wood', 'طراحی مهندسی سازه های چوبی')
    .replace('Accessible Design for Built Environment', 'طراحی دسترس پذیر برای محیط ساخته شده')
    .replace('Building Code (Provincial)', 'کد ساختمان (استانی)')
    .replace('Canadian Environmental Protection Act', 'قانون حفاظت محیط زیست کانادا')
    .replace('Building Environmental Standards', 'استانداردهای زیست محیطی ساختمان')
    .replace('National Energy Code of Canada for Buildings', 'کد ملی انرژی کانادا برای ساختمان ها')
    .replace('German Social Accident Insurance Rules', 'قوانین بیمه اجتماعی حوادث آلمان')
    .replace('Technical Rules for Operational Safety', 'قواعد فنی ایمنی بهره برداری')
    .replace('Trade Association Safety Rules', 'قواعد ایمنی انجمن های صنفی')
    .replace('Hazardous Substances Ordinance', 'آیین نامه مواد خطرناک')
    .replace('German Construction Contract Procedures', 'رویه های قراردادی ساخت و ساز آلمان')
    .replace('General Contract Conditions for Construction', 'شرایط عمومی قراردادهای ساخت')
    .replace('Model Building Code (Musterbauordnung)', 'آیین نامه نمونه ساختمان (MBO)')
    .replace('Concrete Structures', 'سازه های بتنی')
    .replace('Steel & Aluminium Structures', 'سازه های فولادی و آلومینیومی')
    .replace('Electrical Standards', 'استانداردهای برق')
    .replace('Thermal Protection in Buildings', 'حفاظت حرارتی در ساختمان')
    .replace('Sound Insulation in Buildings', 'عایق صوتی در ساختمان')
    .replace('Federal Immission Control Act', 'قانون فدرال کنترل انتشار')
    .replace('German Sustainable Building Council', 'شورای ساختمان پایدار آلمان')
    .replace('Efficiency House Standards', 'استانداردهای خانه کم مصرف')
    .replace('Building Energy Act (Gebäudeenergiegesetz)', 'قانون انرژی ساختمان')
    .replace('EU Framework Directive 89/391/EEC — OHS', 'دستورالعمل چارچوب اتحادیه اروپا 89/391/EEC — ایمنی شغلی')
    .replace('EU Directive 92/57/EEC — Temporary/Mobile Construction Sites', 'دستورالعمل 92/57/EEC اتحادیه اروپا — کارگاه های موقت/سیار')
    .replace('EU Machinery Directive 2006/42/EC', 'دستورالعمل ماشین آلات اتحادیه اروپا 2006/42/EC')
    .replace('EU REACH — Chemical Substances Regulation', 'مقررات REACH اتحادیه اروپا برای مواد شیمیایی')
    .replace('UK HSE CDM Regulations 2015', 'مقررات CDM بریتانیا 2015')
    .replace('France INRS — OHS Reference', 'INRS فرانسه — مرجع ایمنی شغلی')
    .replace('Eurocode: Basis of Structural Design', 'یوروکد: مبانی طراحی سازه ای')
    .replace('Eurocode 1: Actions on Structures', 'یوروکد 1: بارگذاری بر سازه ها')
    .replace('Eurocode 2: Concrete Structures', 'یوروکد 2: سازه های بتنی')
    .replace('Eurocode 3: Steel Structures', 'یوروکد 3: سازه های فولادی')
    .replace('Eurocode 4: Composite Structures', 'یوروکد 4: سازه های مرکب')
    .replace('Eurocode 5: Timber Structures', 'یوروکد 5: سازه های چوبی')
    .replace('Eurocode 6: Masonry Structures', 'یوروکد 6: سازه های بنایی')
    .replace('Eurocode 7: Geotechnical Design', 'یوروکد 7: طراحی ژئوتکنیک')
    .replace('Eurocode 8: Seismic Design', 'یوروکد 8: طراحی لرزه ای')
    .replace('Eurocode 9: Aluminium Structures', 'یوروکد 9: سازه های آلومینیومی')
    .replace('Construction Products Regulation', 'مقررات محصولات ساختمانی')
    .replace('Safety Rules for Lifts', 'قواعد ایمنی آسانسورها')
    .replace('British Adopted European Standards', 'استانداردهای اروپایی پذیرفته شده در بریتانیا')
    .replace('Eco-Management & Audit Scheme', 'طرح مدیریت و ممیزی محیط زیست')
    .replace('Building Research Environmental Assessment', 'روش ارزیابی زیست محیطی ساختمان')
    .replace('Energy Performance of Buildings Directive', 'دستورالعمل عملکرد انرژی ساختمان ها')
    .replace('Waste Framework Directive 2008/98/EC', 'دستورالعمل چارچوب پسماند 2008/98/EC')
    .replace('Water Framework Directive 2000/60/EC', 'دستورالعمل چارچوب آب 2000/60/EC')
    .replace('Iran HSE Regulations — Ministry of Labour', 'مقررات HSE ایران — وزارت کار')
    .replace('Iran Construction Site Safety Bylaws', 'آیین نامه ایمنی کارگاه های ساختمانی ایران')
    .replace('Iran Fire Safety & Emergency Regulations', 'مقررات ایمنی حریق و شرایط اضطراری ایران')
    .replace('Iran Electrical Safety Code (IEEE-IR adapted)', 'کد ایمنی برق ایران (اقتباس IEEE-IR)')
    .replace('Iran National Building Regulations (Melli)', 'مقررات ملی ساختمان ایران (ملی)')
    .replace('Iran Standard 2800 — Seismic Design of Buildings', 'استاندارد 2800 ایران — طراحی لرزه ای ساختمان ها')
    .replace('Iran Standard 413 — Concrete Structures (Aba)', 'استاندارد 413 ایران — سازه های بتنی (آبا)')
    .replace('Iran Standard 414 — Steel Structures Design', 'استاندارد 414 ایران — طراحی سازه های فولادی')
    .replace('Development Plan — Construction Requirements', 'برنامه توسعه — الزامات ساخت و ساز')
    .replace('Tehran / Municipal Building Codes', 'کدهای ساختمانی شهرداری / تهران')
    .replace('Iran Road & Highway Construction Standards', 'استانداردهای راه و بزرگراه ایران')
    .replace('Institute of Standards & Industrial Research', 'موسسه استاندارد و تحقیقات صنعتی')
    .replace('Iran Environmental Protection Law', 'قانون حفاظت محیط زیست ایران')
    .replace('Iran Wastewater Discharge Standards', 'استانداردهای تخلیه فاضلاب ایران')
    .replace('Iran Air Quality & Emissions Standards', 'استانداردهای کیفیت هوا و انتشار ایران')
    .replace('Iran Energy Efficiency in Buildings Directive', 'دستورالعمل بهره وری انرژی در ساختمان های ایران')
}

const standards = Object.fromEntries(
  CONSTRUCTION_STANDARDS.map((standard) => [standard.value, translateStandardFa(standard.label)])
)

export const fa: FormDictionary = {
  ui: {
    back: 'بازگشت',
    next: 'بعدی',
    submit: 'ثبت پروژه',
    step: 'مرحله',
    stepOf: 'از',
    selectPlaceholder: 'یک گزینه انتخاب کنید',
    fixErrors: 'لطفا قبل از ادامه، خطاهای مشخص شده را اصلاح کنید.',
    successMessage: 'راه اندازی اولیه پروژه با موفقیت انجام شد.',
    successTitle: 'پروژه ثبت شد',
    successDescription: 'پروژه شما ذخیره شد. می‌توانید لیست پروژه‌ها را ببینید یا اعضا را اضافه کنید.',
    goToProjects: 'رفتن به پروژه‌ها',
    registerAnother: 'ثبت پروژه جدید',
    countrySearchPlaceholder: 'نام کشور یا حرف اول را تایپ کنید…',
    selected: 'انتخاب شده',
    languageHint: 'زبان فرم مورد استفاده برای این راه اندازی پروژه را انتخاب کنید.',
    mandatoryStandard: 'اجباری',
    selectMandatoryOnly: 'فقط اجباری‌ها',
    selectAllStandards: 'انتخاب همه',
    addCustomStandard: 'افزودن استاندارد',
    removeCustomStandard: 'حذف',
    catalogStandards: 'فهرست',
    customStandardsShort: 'سفارشی',
    customStandardCodePlaceholder: 'مثال: ISIRI 1234',
    customStandardNamePlaceholder: 'عنوان کامل استاندارد',
    customStandardDescPlaceholder: 'یادداشت اختیاری برای بررسی AI',
    showOnMap: 'نمایش روی نقشه',
    mapSearching: 'در حال جستجو…',
    mapLoading: 'در حال بارگذاری نقشه…',
    mapAddressPlaceholder: 'آدرس را تایپ کنید…',
  },
  steps: {
    language: { title: 'زبان', description: 'زبان اصلی راه اندازی پروژه را انتخاب کنید.' },
    projectInfo: { title: 'اطلاعات پروژه', description: 'هویت پروژه، اطلاعات کارفرما، قرارداد و موقعیت را ثبت کنید.' },
    projectTeam: { title: 'تیم پروژه', description: 'نقش های مدیریت، مهندسی، QA/QC و بازرگانی را تعیین کنید.' },
    technicalInfo: { title: 'اطلاعات فنی', description: 'سیستم سازه، شرایط خاک و مرحله طراحی را مشخص کنید.' },
    scheduleHours: { title: 'برنامه زمان بندی و ساعات کاری', description: 'تاریخ های مبنا، تقویم، شیفت ها و کنترل پیشرفت را تنظیم کنید.' },
    standardsLocation: { title: 'انطباق ساخت و استانداردها', description: 'منطقه مقرراتی، استانداردها و موقعیت پروژه را تنظیم کنید.' },
    scheduleUpload: { title: 'بارگذاری برنامه زمان بندی', description: 'فایل برنامه مبنا و قوانین اعتبارسنجی بارگذاری را تعیین کنید.' },
    projectDocuments: { title: 'مدارک پروژه', description: 'قراردادها، نقشه ها، مشخصات و مجوزها را بارگذاری کنید.' },
    projectSettings: { title: 'تنظیمات پروژه', description: 'محلی سازی، سرویس هواشناسی، داشبوردها و دسترسی ها را انتخاب کنید.' },
  },
  subsections: {
    basicInfo: 'اطلاعات پایه',
    client: 'کارفرما',
    organization: 'سازمان',
    contract: 'قرارداد',
    classification: 'طبقه بندی',
    workforce: 'نیروی انسانی',
    notes: 'یادداشت ها',
    location: 'موقعیت',
    management: 'مدیریت',
    engineering: 'مهندسی',
    qa: 'تضمین/کنترل کیفیت',
    commercial: 'بازرگانی',
    structure: 'سازه',
    foundation: 'فونداسیون',
    buildingInfo: 'اطلاعات ساختمان',
    designInfo: 'اطلاعات طراحی',
    dates: 'تاریخ ها',
    calendar: 'تقویم',
    shiftHours: 'شیفت و ساعات کاری',
    progressSettings: 'تنظیمات پیشرفت',
    delayAnalysis: 'تحلیل تاخیر',
    region: 'منطقه',
    complianceFramework: 'چارچوب انطباق',
    projectStandards: 'استانداردهای پروژه',
    customStandards: 'افزودن استاندارد سفارشی',
    activatedStandards: 'استانداردهای فعال',
    additionalStandards: 'استانداردهای تکمیلی',
    standards: 'استانداردها',
    bimSettings: 'تنظیمات BIM',
    regionalSettings: 'تنظیمات منطقه ای',
    weatherProvider: 'ارائه دهنده هواشناسی',
    dashboardModules: 'ماژول های داشبورد',
    permissions: 'دسترسی ها',
    contractDocuments: 'مدارک قراردادی',
    drawings: 'نقشه ها',
    specifications: 'مشخصات',
    permits: 'مجوزها',
  },
  sections: {
    language: { title: 'زبان', description: 'زبان مورد استفاده در این راهنما را مشخص می کند.' },
    projectInfo: { title: 'اطلاعات پروژه', description: 'داده های اصلی پروژه، ذی نفعان، قرارداد و محل پروژه.' },
    projectTeam: { title: 'تیم پروژه', description: 'مسئولان و نقش های کلیدی اجرا.' },
    technicalInfo: { title: 'اطلاعات فنی', description: 'سیستم سازه ای و سطح آمادگی طراحی.' },
    scheduleHours: { title: 'برنامه زمان بندی و ساعات کاری', description: 'تاریخ ها، دسترس پذیری منابع و تناوب گزارش دهی.' },
    standardsLocation: {
      title: 'انطباق ساخت و استانداردها',
      description: 'منطقه مقرراتی و نوع ساخت را انتخاب کنید. برنامه استانداردهای اجباری را تشخیص می‌دهد و شما می‌توانید موارد بیشتری اضافه یا حذف کنید.',
    },
    scheduleUpload: { title: 'بارگذاری برنامه زمان بندی', description: 'وارد کردن برنامه زمان بندی و کنترل خودکار.' },
    projectDocuments: { title: 'مدارک پروژه', description: 'بسته های مدارک مرجع برای اجرای پروژه.' },
    projectSettings: { title: 'تنظیمات پروژه', description: 'پیش فرض های عملیاتی، داشبوردها و مجوز گزارش دهی.' },
  },
  fields: {
    projectName: 'نام پروژه',
    projectCode: 'کد پروژه',
    projectType: 'نوع پروژه',
    status: 'وضعیت پروژه',
    description: 'شرح پروژه',
    clientName: 'نام کارفرما',
    clientContact: 'مسئول ارتباط کارفرما',
    clientEmail: 'ایمیل کارفرما',
    clientPhone: 'تلفن کارفرما',
    organizationName: 'نام سازمان',
    department: 'واحد',
    contractType: 'نوع قرارداد',
    contractNumber: 'شماره قرارداد',
    contractValue: 'مبلغ قرارداد',
    contractStartDate: 'تاریخ شروع قرارداد',
    contractEndDate: 'تاریخ پایان قرارداد',
    buildingClassification: 'طبقه بندی ساختمان',
    projectPhase: 'فاز پروژه',
    sector: 'بخش',
    estimatedWorkforce: 'نیروی انسانی برآوردی',
    peakWorkforce: 'حداکثر نیروی انسانی',
    internalNotes: 'یادداشت های داخلی',
    publicNotes: 'یادداشت های عمومی',
    address: 'آدرس کارگاه',
    city: 'شهر',
    country: 'کشور',
    latitude: 'عرض جغرافیایی',
    longitude: 'طول جغرافیایی',
    mapLocation: 'نقشه موقعیت کارگاه',
    siteArea: 'مساحت سایت (متر مربع)',
    projectDirector: 'مدیر ارشد پروژه',
    projectManager: 'مدیر پروژه',
    constructionManager: 'مدیر ساخت',
    leadEngineer: 'مهندس ارشد',
    structuralEngineer: 'مهندس سازه',
    mepEngineer: 'مهندس MEP',
    qaManager: 'مدیر تضمین کیفیت',
    qcInspector: 'بازرس کنترل کیفیت',
    commercialManager: 'مدیر بازرگانی',
    procurementLead: 'سرپرست تامین',
    structureType: 'نوع سازه',
    primaryMaterial: 'مصالح اصلی',
    foundationType: 'نوع فونداسیون',
    soilClassification: 'طبقه بندی خاک',
    numberOfFloors: 'تعداد طبقات',
    totalBuiltArea: 'زیربنای کل (متر مربع)',
    basementLevels: 'تعداد طبقات زیرزمین',
    designStage: 'مرحله طراحی',
    designStandard: 'استاندارد طراحی',
    architectFirm: 'شرکت معماری',
    plannedStartDate: 'تاریخ شروع برنامه ای',
    plannedFinishDate: 'تاریخ پایان برنامه ای',
    actualStartDate: 'تاریخ شروع واقعی',
    workingDaysPerWeek: 'روزهای کاری در هفته',
    publicHolidayCalendar: 'تقویم تعطیلات رسمی',
    shiftPattern: 'الگوی شیفت',
    dailyWorkHours: 'ساعات کاری روزانه',
    nightShiftEnabled: 'فعال سازی شیفت شب',
    progressMeasurementMethod: 'روش سنجش پیشرفت',
    reportingFrequency: 'تناوب گزارش دهی',
    delayAnalysisEnabled: 'فعال سازی تحلیل تاخیر',
    criticalPathMonitoring: 'فعال سازی پایش مسیر بحرانی',
    region: 'منطقه',
    timezone: 'منطقه زمانی',
    regulatoryRegion: 'منطقه مقرراتی',
    regulatoryRegions: 'منطقه‌های مقرراتی',
    useCustomRegulatory: 'چارچوب مقرراتی سفارشی',
    constructionType: 'نوع ساخت',
    selectedStandards: 'استانداردهای انتخاب‌شده',
    additionalStandards: 'استانداردهای تکمیلی',
    customRegulatoryNote: 'چارچوب مقرراتی سفارشی',
    customStandardNote: 'جزئیات استاندارد سفارشی',
    customStandardCode: 'کد / مرجع استاندارد',
    customStandardName: 'نام استاندارد',
    customStandardDescription: 'یادداشت (اختیاری)',
    standardsCount: 'استاندارد',
    standardsFilterRegion: 'منطقه فیلتر استانداردها',
    safetyStandard: 'استاندارد ایمنی',
    qualityStandard: 'استاندارد کیفیت',
    environmentalStandard: 'استاندارد محیط زیست',
    bimEnabled: 'فعال سازی BIM',
    bimLevel: 'سطح BIM',
    modelCoordinationRequired: 'نیاز به هماهنگی مدل',
    scheduleFileName: 'نام فایل برنامه زمان بندی',
    validateScheduleOnUpload: 'اعتبارسنجی برنامه هنگام بارگذاری',
    autoLinkActivities: 'اتصال خودکار فعالیت ها',
    requireBaselineApproval: 'الزام تایید خط مبنا',
    contractDocumentsFile: 'فایل مدارک قرارداد',
    contractDocumentsNote: 'یادداشت مدارک قرارداد',
    drawingsFile: 'فایل نقشه ها',
    drawingsNote: 'یادداشت نقشه ها',
    specificationsFile: 'فایل مشخصات',
    specificationsNote: 'یادداشت مشخصات',
    permitsFile: 'فایل مجوزها',
    permitsNote: 'یادداشت مجوزها',
    currency: 'واحد پول',
    language: 'زبان پروژه',
    dateFormat: 'قالب تاریخ',
    weatherProvider: 'ارائه دهنده هواشناسی',
    enableWeatherAlerts: 'فعال سازی هشدار هواشناسی',
    enableSafetyDashboard: 'فعال سازی داشبورد ایمنی',
    enableProgressDashboard: 'فعال سازی داشبورد پیشرفت',
    enableCostDashboard: 'فعال سازی داشبورد هزینه',
    allowFieldReporting: 'اجازه گزارش میدانی',
    allowPhotoUpload: 'اجازه بارگذاری عکس',
    requireApprovalForReports: 'الزام تایید گزارش ها',
    interfaceLanguage: 'زبان رابط',
  },
  descriptions: {
    description: 'شرح کوتاهی از دامنه پروژه وارد کنید.',
    contractValue: 'مبلغ کل قرارداد را با واحد پول انتخاب شده ثبت کنید.',
    siteArea: 'مساحت کل سایت پروژه به متر مربع.',
    estimatedWorkforce: 'میانگین نیروی مورد انتظار در سایت.',
    peakWorkforce: 'بیشترین نیروی انسانی مورد انتظار در اوج اجرا.',
    latitude: 'مختصات عرض جغرافیایی (اختیاری).',
    longitude: 'مختصات طول جغرافیایی (اختیاری).',
    mapAddressHint: 'آدرس را تایپ کنید تا پیشنهاد گوگل بیاید، یا روی نقشه کلیک کنید تا موقعیت دقیق کارگاه مشخص شود.',
    mapClickHint: 'روی نقشه کلیک کنید یا نشانگر را بکشید تا مختصات دقیق تنظیم شود.',
    mapApiKeyMissing: 'برای فعال شدن نقشه، کلید NEXT_PUBLIC_GOOGLE_MAPS_API_KEY را در فایل .env.local قرار دهید (Maps JavaScript، Places و Geocoding).',
    mapLoadError: 'بارگذاری Google Maps ناموفق بود. کلید API و APIهای فعال‌شده را بررسی کنید.',
    mapOsmFallback: 'نقشه تعاملی با OpenStreetMap فعال است. برای پیشنهاد آدرس Google، کلید API را در .env.local اضافه کنید.',
    dailyWorkHours: 'بازه مجاز: 1 تا 24 ساعت در روز.',
    scheduleFileName: 'نام یا شناسه مرجع فایل برنامه مبنا.',
    regulatoryRegion: 'چارچوب مقرراتی کشور را تعیین می‌کند. فهرست کامل استانداردها نمایش داده می‌شود.',
    regulatoryRegions: 'همه چارچوب‌های مرتبط را انتخاب کنید — مثلاً آلمان و اتحادیه اروپا با هم.',
    useCustomRegulatory: 'فقط اگر پروژه چارچوب کاملاً سفارشی دارد فعال کنید.',
    scheduleAcceptedFormats: 'فرمت‌های قابل قبول: Excel (.xlsx, .csv)، Oracle Primavera (.xer)، Microsoft Project (.mpp, .xml)',
    constructionType: 'نوع پروژه برای تعیین استانداردهای اجباری تخصصی (پل، تونل، صنعتی و …).',
    additionalStandards: 'گواهی‌ها و استانداردهای اختیاری علاوه بر مجموعه مقرراتی.',
    customRegulatoryNote: 'وقتی منطقه «سفارشی» انتخاب شده، چارچوب مقرراتی را توضیح دهید.',
    customStandardNote: 'استانداردهای سفارشی پروژه را شرح دهید.',
    compliancePreviewEmpty: 'منطقه مقرراتی و نوع ساخت را انتخاب کنید تا فهرست استانداردها نمایش داده شود.',
    complianceEngineNote: 'استانداردهای انتخاب‌شده در سیستم ذخیره می‌شوند و SitePilot AI از آن‌ها برای گزارش، ایمنی، کیفیت و هشدار انطباق استفاده می‌کند.',
    customStandardsHint: 'اگر استاندارد مورد نیاز در فهرست زیر نیست، اینجا اضافه کنید. استانداردهای سفارشی در بررسی انطباق AI لحاظ می‌شوند.',
    customStandardsEmpty: 'هنوز استاندارد سفارشی اضافه نشده است.',
    complianceCustomEmpty: 'برای منطقه سفارشی استاندارد خودکار وجود ندارد — استانداردهای سفارشی را پایین اضافه کنید یا یادداشت بنویسید.',
    aiContextPreview: 'زمینه انطباق AI (داخلی)',
    standardsFilterRegion: 'فهرست استانداردها را بر اساس حوزه مقرراتی فیلتر می کند.',
    safetyStandard: 'استاندارد اصلی ایمنی برای کنترل های انطباق.',
    qualityStandard: 'استاندارد اصلی کیفیت برای اجرا و بازرسی.',
    environmentalStandard: 'چارچوب اصلی محیط زیست برای پایداری و مجوزها.',
    bimEnabled: 'برنامه ریزی و کنترل های مرتبط با BIM را فعال می کند.',
    modelCoordinationRequired: 'بازبینی هماهنگی مدل بین رشته ای را الزامی می کند.',
    validateScheduleOnUpload: 'پس از بارگذاری برنامه، کنترل های خودکار اجرا می شود.',
    autoLinkActivities: 'فعالیت های برنامه را خودکار به بسته های کاری متصل می کند.',
    requireBaselineApproval: 'خط مبنا تا زمان تایید رسمی قفل می ماند.',
    contractDocumentsNote: 'توضیحات تکمیلی درباره مدارک قرارداد را ثبت کنید.',
    drawingsNote: 'یادداشت نسخه، وضعیت یا بازنگری نقشه ها.',
    specificationsNote: 'یادداشت کامل بودن یا بازنگری مشخصات.',
    permitsNote: 'محدودیت ها، اعتبار یا نکات مرجع مجوزها.',
    enableWeatherAlerts: 'هشدارهای ریسک هواشناسی در عملیات روزانه نمایش داده شود.',
    enableSafetyDashboard: 'شاخص های ایمنی و رخدادها فعال شود.',
    enableProgressDashboard: 'نمایش های پیشرفت و عملکرد فعال شود.',
    enableCostDashboard: 'نمایش بودجه و عملکرد هزینه فعال شود.',
    allowFieldReporting: 'به تیم سایت اجازه ارسال گزارش های روزانه می دهد.',
    allowPhotoUpload: 'اجازه الصاق تصاویر مستند در گزارش ها.',
    requireApprovalForReports: 'ارسال گزارش ها از مسیر تایید قبل از انتشار.',
    language: 'زبان پیش فرض برای محتوای تولیدی پروژه.',
    interfaceLanguage: 'زبان مورد استفاده هنگام تکمیل فرم راه اندازی.',
  },
  options: {
    projectTypes: {
      commercial: 'تجاری',
      residential: 'مسکونی',
      infrastructure: 'زیرساخت',
      industrial: 'صنعتی',
      healthcare: 'درمانی',
      mixed_use: 'چندمنظوره',
    },
    projectStatuses: {
      planning: 'در حال برنامه ریزی',
      active: 'فعال',
      on_hold: 'متوقف',
      completed: 'تکمیل شده',
    },
    contractTypes: {
      lump_sum: 'مقطوع',
      cost_plus: 'هزینه به علاوه',
      guaranteed_maximum_price: 'حداکثر قیمت تضمینی (GMP)',
      design_build: 'طراحی و ساخت',
      epc: 'مهندسی، تامین، اجرا (EPC)',
      unit_price: 'قیمت واحد',
    },
    buildingClassifications: {
      class_a: 'کلاس A',
      class_b: 'کلاس B',
      class_c: 'کلاس C',
      special_purpose: 'کاربری ویژه',
    },
    projectPhases: {
      pre_construction: 'پیش از ساخت',
      construction: 'ساخت',
      commissioning: 'راه اندازی',
      closeout: 'اختتام',
    },
    sectors: {
      public: 'بخش دولتی',
      private: 'بخش خصوصی',
      ppp: 'مشارکت عمومی-خصوصی',
    },
    countries: {
      IR: 'ایران',
      AE: 'امارات متحده عربی',
      TR: 'ترکیه',
      US: 'ایالات متحده',
      GB: 'بریتانیا',
      DE: 'آلمان',
    },
    structureTypes: {
      concrete: 'بتن مسلح',
      steel: 'فولاد سازه ای',
      composite: 'مرکب',
      timber: 'چوبی',
      masonry: 'بنایی',
    },
    foundationTypes: {
      shallow: 'پی سطحی',
      deep_pile: 'پی عمیق شمعی',
      raft: 'رادیه',
      caisson: 'کیسون',
    },
    soilClassifications: {
      rock: 'سنگی',
      hard_clay: 'رس سخت',
      soft_clay: 'رس نرم',
      sand: 'ماسه ای',
      mixed: 'مختلط / نامشخص',
    },
    designStages: {
      concept: 'طراحی مفهومی',
      schematic: 'طراحی شماتیک',
      detailed: 'طراحی تفصیلی',
      construction_docs: 'مدارک اجرایی',
    },
    workingDays: {
      '5': '5 روز / هفته',
      '6': '6 روز / هفته',
      '7': '7 روز / هفته',
    },
    holidayCalendars: {
      national: 'تقویم ملی',
      regional: 'تقویم منطقه ای',
      custom: 'تقویم سفارشی پروژه',
    },
    shiftPatterns: {
      single: 'تک شیفت',
      double: 'دو شیفت',
      triple: 'سه شیفت',
      continuous: 'پیوسته (24/7)',
    },
    progressMethods: {
      physical: 'پیشرفت فیزیکی (%)',
      earned_value: 'ارزش کسب شده',
      milestone: 'مبتنی بر مایلستون',
      quantity: 'مبتنی بر مقدار',
    },
    reportingFrequencies: {
      daily: 'روزانه',
      weekly: 'هفتگی',
      biweekly: 'دو هفته یکبار',
      monthly: 'ماهانه',
    },
    regions: {
      middle_east: 'خاورمیانه',
      europe: 'اروپا',
      north_america: 'آمریکای شمالی',
      asia_pacific: 'آسیا-اقیانوسیه',
    },
    timezones: {
      'Asia/Tehran': 'Asia/Tehran (IRST)',
      'Asia/Dubai': 'Asia/Dubai (GST)',
      'Europe/London': 'Europe/London (GMT/BST)',
      'America/New_York': 'America/New_York (EST/EDT)',
    },
    regulatoryRegions: {
      germany: 'آلمان',
      european_union: 'اتحادیه اروپا',
      united_states: 'ایالات متحده',
      canada: 'کانادا',
      iran: 'ایران',
      international: 'بین‌المللی',
      custom: 'سفارشی',
    },
    constructionTypes: {
      general_building: 'ساختمان عمومی',
      industrial_building: 'ساختمان صنعتی',
      industrial_plant: 'کارخانه / پالایشگاه',
      infrastructure: 'زیرساخت',
      bridge: 'پل',
      tunnel: 'تونل',
      railway: 'راه‌آهن',
      utility: 'تاسیسات / تأسیسات شهری',
    },
    additionalStandards: {
      iso_9001: 'ISO 9001 — مدیریت کیفیت',
      iso_14001: 'ISO 14001 — مدیریت محیط زیست',
      iso_45001: 'ISO 45001 — ایمنی و بهداشت شغلی',
      iso_19650: 'ISO 19650 — مدیریت اطلاعات BIM',
      leed: 'LEED — گواهی ساختمان سبز',
      breeam: 'BREEAM — ارزیابی زیست‌محیطی ساختمان',
      dgnb: 'DGNB — شورای ساختمان پایدار آلمان',
      custom: 'استاندارد سفارشی',
    },
    standardsRegions: {
      ALL: 'همه مناطق',
      US: 'ایالات متحده',
      CA: 'کانادا',
      DE: 'آلمان',
      EU: 'اروپا (اتحادیه اروپا / یوروکد)',
      IR: 'ایران',
      INTL: 'بین المللی',
    },
    bimLevels: {
      none: 'بدون BIM',
      level_1: 'BIM سطح 1',
      level_2: 'BIM سطح 2',
      level_3: 'BIM سطح 3',
    },
    currencies: {
      USD: 'USD — دلار آمریکا',
      EUR: 'EUR — یورو',
      IRR: 'IRR — ریال ایران',
      AED: 'AED — درهم امارات',
      GBP: 'GBP — پوند بریتانیا',
    },
    languages: {
      en: 'انگلیسی',
      ar: 'عربی',
      fa: 'فارسی',
      de: 'آلمانی',
      fr: 'فرانسوی',
    },
    dateFormats: {
      'YYYY-MM-DD': 'YYYY-MM-DD',
      'DD/MM/YYYY': 'DD/MM/YYYY',
      'MM/DD/YYYY': 'MM/DD/YYYY',
    },
    weatherProviders: {
      openweather: 'OpenWeather',
      weatherapi: 'WeatherAPI',
      manual: 'فقط ورود دستی',
    },
  },
  standardRegionGroups: {
    US: 'ایالات متحده',
    CA: 'کانادا',
    DE: 'آلمان',
    EU: 'اروپا (اتحادیه اروپا / یوروکد)',
    IR: 'ایران',
    INTL: 'بین المللی',
    ALL: 'همه مناطق',
  },
  standards,
  validation: {
    selectLanguage: 'لطفا زبان پروژه را انتخاب کنید.',
    projectNameRequired: 'نام پروژه الزامی است.',
    projectCodeRequired: 'کد پروژه الزامی است.',
    projectTypeRequired: 'نوع پروژه الزامی است.',
    statusRequired: 'وضعیت پروژه الزامی است.',
    clientNameRequired: 'نام کارفرما الزامی است.',
    contractTypeRequired: 'نوع قرارداد الزامی است.',
    buildingClassificationRequired: 'طبقه بندی ساختمان الزامی است.',
    projectPhaseRequired: 'فاز پروژه الزامی است.',
    addressRequired: 'آدرس سایت الزامی است.',
    cityRequired: 'شهر الزامی است.',
    countryRequired: 'کشور الزامی است.',
    projectManagerRequired: 'مدیر پروژه الزامی است.',
    structureTypeRequired: 'نوع سازه الزامی است.',
    foundationTypeRequired: 'نوع فونداسیون الزامی است.',
    designStageRequired: 'مرحله طراحی الزامی است.',
    plannedStartRequired: 'تاریخ شروع برنامه ای الزامی است.',
    plannedFinishRequired: 'تاریخ پایان برنامه ای الزامی است.',
    workingDaysRequired: 'تعداد روزهای کاری الزامی است.',
    holidayCalendarRequired: 'تقویم تعطیلات الزامی است.',
    shiftPatternRequired: 'الگوی شیفت الزامی است.',
    dailyWorkHoursMin: 'ساعات کاری روزانه باید حداقل 1 باشد.',
    dailyWorkHoursMax: 'ساعات کاری روزانه نباید بیشتر از 24 باشد.',
    progressMethodRequired: 'روش سنجش پیشرفت الزامی است.',
    reportingFrequencyRequired: 'تناوب گزارش دهی الزامی است.',
    regionRequired: 'منطقه الزامی است.',
    timezoneRequired: 'منطقه زمانی الزامی است.',
    regulatoryRegionRequired: 'انتخاب منطقه مقرراتی الزامی است.',
    constructionTypeRequired: 'انتخاب نوع ساخت الزامی است.',
    customStandardCodeRequired: 'کد استاندارد الزامی است.',
    customStandardNameRequired: 'نام استاندارد باید حداقل ۲ کاراکتر باشد.',
    customStandardDuplicate: 'این کد یا نام استاندارد قبلاً اضافه شده است.',
    safetyStandardRequired: 'استاندارد ایمنی الزامی است.',
    currencyRequired: 'واحد پول الزامی است.',
    languageRequired: 'زبان الزامی است.',
    dateFormatRequired: 'قالب تاریخ الزامی است.',
    weatherProviderRequired: 'ارائه دهنده هواشناسی الزامی است.',
    finishDateAfterStart: 'تاریخ پایان باید همزمان یا بعد از تاریخ شروع باشد.',
    invalidEmail: 'لطفا یک ایمیل معتبر وارد کنید.',
  },
}
