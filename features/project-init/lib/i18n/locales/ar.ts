import { CONSTRUCTION_STANDARDS } from '../../standards-catalog'
import type { FormDictionary } from '../types'

function translateStandardAr(label: string): string {
  return label
    .replace('Occupational Health & Safety', 'الصحة والسلامة المهنية')
    .replace('Quality Management', 'إدارة الجودة')
    .replace('Environmental Management', 'الإدارة البيئية')
    .replace('Energy Management', 'إدارة الطاقة')
    .replace('BIM / Information Management', 'إدارة معلومات BIM')
    .replace('Open BIM Data Model', 'نموذج بيانات BIM المفتوح')
    .replace('Construction Safety', 'سلامة مواقع الإنشاء')
    .replace('General Industry', 'الصناعة العامة')
    .replace('Occupational Safety Guidelines', 'إرشادات السلامة المهنية')
    .replace('OHS Management Systems', 'أنظمة إدارة السلامة والصحة المهنية')
    .replace('Electrical Safety in Workplace', 'السلامة الكهربائية في موقع العمل')
    .replace('Life Safety Code', 'كود سلامة الأرواح')
    .replace('Mine Safety (when applicable)', 'سلامة التعدين (عند الانطباق)')
    .replace('International Building Code', 'الكود الدولي للبناء')
    .replace('International Residential Code', 'الكود الدولي للمباني السكنية')
    .replace('International Energy Conservation Code', 'الكود الدولي لترشيد الطاقة')
    .replace('International Mechanical Code', 'الكود الدولي للأعمال الميكانيكية')
    .replace('International Plumbing Code', 'الكود الدولي للتمديدات الصحية')
    .replace('International Fire Code', 'الكود الدولي للوقاية من الحريق')
    .replace('American Society for Testing & Materials', 'الجمعية الأمريكية للاختبارات والمواد')
    .replace('Structural Concrete', 'الخرسانة الإنشائية')
    .replace('Structural Steel Buildings', 'المباني الهيكلية الفولاذية')
    .replace('Minimum Design Loads', 'الأحمال الدنيا للتصميم')
    .replace('Highway & Bridge Design', 'تصميم الطرق السريعة والجسور')
    .replace('National Electrical Safety Code', 'الكود الوطني للسلامة الكهربائية')
    .replace('Product Safety Certification', 'اعتماد سلامة المنتجات')
    .replace('Environmental Protection', 'حماية البيئة')
    .replace('Green Building Certification', 'شهادة المباني الخضراء')
    .replace('WELL Building Standard', 'معيار WELL للمباني')
    .replace('Energy Standard for Buildings', 'معيار كفاءة الطاقة للمباني')
    .replace('Hazardous Sites', 'المواقع الخطرة')
    .replace('OHS Management', 'إدارة السلامة والصحة المهنية')
    .replace('OHS Training', 'تدريب السلامة والصحة المهنية')
    .replace('Canadian Centre for OHS', 'المركز الكندي للسلامة والصحة المهنية')
    .replace('Act Respecting OHS', 'قانون السلامة والصحة المهنية')
    .replace('National Building Code of Canada', 'الكود الوطني الكندي للبناء')
    .replace('National Fire Code of Canada', 'الكود الوطني الكندي للحريق')
    .replace('National Plumbing Code of Canada', 'الكود الوطني الكندي للتمديدات الصحية')
    .replace('Concrete Materials & Construction', 'مواد الخرسانة وتنفيذها')
    .replace('Design of Steel Structures', 'تصميم المنشآت الفولاذية')
    .replace('Engineering Design in Wood', 'التصميم الهندسي للمنشآت الخشبية')
    .replace('Accessible Design for Built Environment', 'التصميم الميسر للبيئة المبنية')
    .replace('Building Code (Provincial)', 'كود البناء (إقليمي)')
    .replace('Canadian Environmental Protection Act', 'قانون حماية البيئة الكندي')
    .replace('Building Environmental Standards', 'المعايير البيئية للمباني')
    .replace('National Energy Code of Canada for Buildings', 'الكود الوطني الكندي للطاقة للمباني')
    .replace('German Social Accident Insurance Rules', 'قواعد التأمين الألماني للحوادث المهنية')
    .replace('Technical Rules for Operational Safety', 'القواعد الفنية للسلامة التشغيلية')
    .replace('Trade Association Safety Rules', 'قواعد السلامة للهيئات المهنية')
    .replace('Hazardous Substances Ordinance', 'لائحة المواد الخطرة')
    .replace('German Construction Contract Procedures', 'إجراءات العقود الألمانية لأعمال البناء')
    .replace('General Contract Conditions for Construction', 'الشروط العامة لعقود البناء')
    .replace('Model Building Code (Musterbauordnung)', 'الكود النموذجي للبناء (MBO)')
    .replace('Concrete Structures', 'المنشآت الخرسانية')
    .replace('Steel & Aluminium Structures', 'منشآت الفولاذ والألمنيوم')
    .replace('Electrical Standards', 'المعايير الكهربائية')
    .replace('Thermal Protection in Buildings', 'الحماية الحرارية في المباني')
    .replace('Sound Insulation in Buildings', 'العزل الصوتي في المباني')
    .replace('Federal Immission Control Act', 'القانون الاتحادي للتحكم في الانبعاثات')
    .replace('German Sustainable Building Council', 'المجلس الألماني للمباني المستدامة')
    .replace('Efficiency House Standards', 'معايير كفاءة الطاقة للمباني')
    .replace('Building Energy Act (Gebäudeenergiegesetz)', 'قانون طاقة المباني')
    .replace('EU Framework Directive 89/391/EEC — OHS', 'التوجيه الإطاري للاتحاد الأوروبي 89/391/EEC — السلامة المهنية')
    .replace('EU Directive 92/57/EEC — Temporary/Mobile Construction Sites', 'توجيه الاتحاد الأوروبي 92/57/EEC — مواقع البناء المؤقتة/المتنقلة')
    .replace('EU Machinery Directive 2006/42/EC', 'توجيه الآلات للاتحاد الأوروبي 2006/42/EC')
    .replace('EU REACH — Chemical Substances Regulation', 'لائحة REACH الأوروبية للمواد الكيميائية')
    .replace('UK HSE CDM Regulations 2015', 'لوائح CDM البريطانية لعام 2015')
    .replace('France INRS — OHS Reference', 'INRS فرنسا — مرجع السلامة المهنية')
    .replace('Eurocode: Basis of Structural Design', 'اليوروكود: أسس التصميم الإنشائي')
    .replace('Eurocode 1: Actions on Structures', 'اليوروكود 1: الأحمال على المنشآت')
    .replace('Eurocode 2: Concrete Structures', 'اليوروكود 2: المنشآت الخرسانية')
    .replace('Eurocode 3: Steel Structures', 'اليوروكود 3: المنشآت الفولاذية')
    .replace('Eurocode 4: Composite Structures', 'اليوروكود 4: المنشآت المركبة')
    .replace('Eurocode 5: Timber Structures', 'اليوروكود 5: المنشآت الخشبية')
    .replace('Eurocode 6: Masonry Structures', 'اليوروكود 6: منشآت المباني الطوبية')
    .replace('Eurocode 7: Geotechnical Design', 'اليوروكود 7: التصميم الجيوتكنيكي')
    .replace('Eurocode 8: Seismic Design', 'اليوروكود 8: التصميم الزلزالي')
    .replace('Eurocode 9: Aluminium Structures', 'اليوروكود 9: منشآت الألمنيوم')
    .replace('Construction Products Regulation', 'لائحة منتجات البناء')
    .replace('Safety Rules for Lifts', 'قواعد السلامة للمصاعد')
    .replace('British Adopted European Standards', 'المعايير الأوروبية المعتمدة في بريطانيا')
    .replace('Eco-Management & Audit Scheme', 'نظام الإدارة والتدقيق البيئي')
    .replace('Building Research Environmental Assessment', 'منهج تقييم الأثر البيئي للمباني')
    .replace('Energy Performance of Buildings Directive', 'توجيه كفاءة الطاقة للمباني')
    .replace('Waste Framework Directive 2008/98/EC', 'التوجيه الإطاري للنفايات 2008/98/EC')
    .replace('Water Framework Directive 2000/60/EC', 'التوجيه الإطاري للمياه 2000/60/EC')
    .replace('Iran HSE Regulations — Ministry of Labour', 'لوائح السلامة والصحة المهنية الإيرانية — وزارة العمل')
    .replace('Iran Construction Site Safety Bylaws', 'لوائح سلامة مواقع البناء الإيرانية')
    .replace('Iran Fire Safety & Emergency Regulations', 'لوائح السلامة من الحريق والطوارئ الإيرانية')
    .replace('Iran Electrical Safety Code (IEEE-IR adapted)', 'كود السلامة الكهربائية الإيراني (مكيف IEEE-IR)')
    .replace('Iran National Building Regulations (Melli)', 'اللائحة الوطنية الإيرانية للبناء (ملّي)')
    .replace('Iran Standard 2800 — Seismic Design of Buildings', 'المعيار الإيراني 2800 — التصميم الزلزالي للمباني')
    .replace('Iran Standard 413 — Concrete Structures (Aba)', 'المعيار الإيراني 413 — المنشآت الخرسانية (Aba)')
    .replace('Iran Standard 414 — Steel Structures Design', 'المعيار الإيراني 414 — تصميم المنشآت الفولاذية')
    .replace('Development Plan — Construction Requirements', 'خطة التنمية — متطلبات البناء')
    .replace('Tehran / Municipal Building Codes', 'أكواد البناء البلدية / طهران')
    .replace('Iran Road & Highway Construction Standards', 'معايير الطرق والطرق السريعة الإيرانية')
    .replace('Institute of Standards & Industrial Research', 'معهد المواصفات والبحوث الصناعية الإيراني')
    .replace('Iran Environmental Protection Law', 'قانون حماية البيئة الإيراني')
    .replace('Iran Wastewater Discharge Standards', 'معايير تصريف مياه الصرف الإيرانية')
    .replace('Iran Air Quality & Emissions Standards', 'معايير جودة الهواء والانبعاثات الإيرانية')
    .replace('Iran Energy Efficiency in Buildings Directive', 'توجيه كفاءة الطاقة في المباني الإيراني')
}

const standards = Object.fromEntries(
  CONSTRUCTION_STANDARDS.map((standard) => [standard.value, translateStandardAr(standard.label)])
)

export const ar: FormDictionary = {
  ui: {
    back: 'رجوع',
    next: 'التالي',
    submit: 'إنشاء المشروع',
    step: 'الخطوة',
    stepOf: 'من',
    selectPlaceholder: 'اختر خياراً',
    fixErrors: 'يرجى تصحيح الحقول المميزة قبل المتابعة.',
    successMessage: 'تم إكمال تهيئة المشروع بنجاح.',
    successTitle: 'تم تسجيل المشروع',
    successDescription: 'تم حفظ مشروعك.',
    goToProjects: 'الذهاب إلى المشاريع',
    registerAnother: 'تسجيل مشروع آخر',
    countrySearchPlaceholder: 'اكتب اسم الدولة…',
    selected: 'محدد',
    languageHint: 'اختر لغة النموذج المستخدمة في إعداد هذا المشروع.',
    mandatoryStandard: 'إلزامي',
    selectMandatoryOnly: 'الإلزامية فقط',
    selectAllStandards: 'تحديد الكل',
    addCustomStandard: 'إضافة معيار',
    removeCustomStandard: 'إزالة',
    catalogStandards: 'الفهرس',
    customStandardsShort: 'مخصص',
    customStandardCodePlaceholder: 'مثال: SASO 1234',
    customStandardNamePlaceholder: 'العنوان الكامل للمعيار',
    customStandardDescPlaceholder: 'ملاحظات اختيارية لفحوصات الامتثال بالذكاء الاصطناعي',
    showOnMap: 'عرض على الخريطة',
    mapSearching: 'جارٍ البحث…',
    mapLoading: 'جارٍ تحميل الخريطة…',
    mapAddressPlaceholder: 'اكتب عنواناً…',
  },
  steps: {
    language: { title: 'اللغة', description: 'اختر اللغة الأساسية لإعداد المشروع.' },
    projectInfo: { title: 'معلومات المشروع', description: 'أدخل هوية المشروع وبيانات العميل والعقد والموقع.' },
    projectTeam: { title: 'فريق المشروع', description: 'حدد أدوار الإدارة والهندسة وضمان الجودة والشؤون التجارية.' },
    technicalInfo: { title: 'المعلومات الفنية', description: 'عرّف النظام الإنشائي والتربة ومرحلة التصميم.' },
    scheduleHours: { title: 'الجدول وساعات العمل', description: 'اضبط التواريخ الأساسية والتقويم والورديات وضوابط التقدم.' },
    standardsLocation: { title: 'الامتثال الإنشائي', description: 'تكوين المنطقة التنظيمية ونوع الإنشاء والمعايير المفعّلة تلقائياً.' },
    scheduleUpload: { title: 'رفع الجدول', description: 'قم برفع ملف الجدول الأساسي وخيارات التحقق.' },
    projectDocuments: { title: 'مستندات المشروع', description: 'ارفع العقود والمخططات والمواصفات والتصاريح.' },
    projectSettings: { title: 'إعدادات المشروع', description: 'اختر الإعدادات الإقليمية والطقس ولوحات المتابعة والصلاحيات.' },
  },
  subsections: {
    basicInfo: 'البيانات الأساسية',
    client: 'العميل',
    organization: 'الجهة',
    contract: 'العقد',
    classification: 'التصنيف',
    workforce: 'القوى العاملة',
    notes: 'ملاحظات',
    location: 'الموقع',
    management: 'الإدارة',
    engineering: 'الهندسة',
    qa: 'ضمان/ضبط الجودة',
    commercial: 'الشؤون التجارية',
    structure: 'النظام الإنشائي',
    foundation: 'الأساسات',
    buildingInfo: 'معلومات المبنى',
    designInfo: 'معلومات التصميم',
    dates: 'التواريخ',
    calendar: 'التقويم',
    shiftHours: 'الورديات وساعات العمل',
    progressSettings: 'إعدادات التقدم',
    delayAnalysis: 'تحليل التأخير',
    region: 'المنطقة',
    complianceFramework: 'إطار الامتثال',
    projectStandards: 'معايير المشروع',
    activatedStandards: 'المعايير المفعّلة تلقائياً',
    additionalStandards: 'معايير إضافية',
    standards: 'المعايير',
    bimSettings: 'إعدادات BIM',
    regionalSettings: 'الإعدادات الإقليمية',
    weatherProvider: 'مزود الطقس',
    dashboardModules: 'وحدات لوحة المتابعة',
    permissions: 'الصلاحيات',
    contractDocuments: 'وثائق العقد',
    drawings: 'المخططات',
    specifications: 'المواصفات',
    permits: 'التصاريح',
  },
  sections: {
    language: { title: 'اللغة', description: 'حدد اللغة المستخدمة في هذا المعالج.' },
    projectInfo: { title: 'معلومات المشروع', description: 'بيانات المشروع الأساسية وأصحاب المصلحة والعقد والموقع.' },
    projectTeam: { title: 'فريق المشروع', description: 'المسؤولون والأدوار الرئيسية للتنفيذ.' },
    technicalInfo: { title: 'المعلومات الفنية', description: 'النظام الإنشائي ومستوى نضج التصميم.' },
    scheduleHours: { title: 'الجدول وساعات العمل', description: 'التواريخ والتوفر وتكرار التقارير.' },
    standardsLocation: {
      title: 'الامتثال الإنشائي',
      description: 'حدّد المنطقة التنظيمية ونوع الإنشاء. يتم اكتشاف المعايير الإلزامية تلقائياً؛ يمكنك إضافة أو إزالة المعايير الاختيارية حسب الحاجة.',
    },
    scheduleUpload: { title: 'رفع الجدول', description: 'استيراد الجدول والتحقق الآلي من سلامته.' },
    projectDocuments: { title: 'مستندات المشروع', description: 'حزم المستندات المرجعية للتنفيذ.' },
    projectSettings: { title: 'إعدادات المشروع', description: 'الافتراضيات التشغيلية ولوحات المتابعة وصلاحيات التقارير.' },
  },
  fields: {
    projectName: 'اسم المشروع',
    projectCode: 'رمز المشروع',
    projectType: 'نوع المشروع',
    status: 'حالة المشروع',
    description: 'وصف المشروع',
    clientName: 'اسم العميل',
    clientContact: 'جهة اتصال العميل',
    clientEmail: 'بريد العميل الإلكتروني',
    clientPhone: 'هاتف العميل',
    organizationName: 'اسم الجهة',
    department: 'القسم',
    contractType: 'نوع العقد',
    contractNumber: 'رقم العقد',
    contractValue: 'قيمة العقد',
    contractStartDate: 'تاريخ بدء العقد',
    contractEndDate: 'تاريخ انتهاء العقد',
    buildingClassification: 'تصنيف المبنى',
    projectPhase: 'مرحلة المشروع',
    sector: 'القطاع',
    estimatedWorkforce: 'عدد القوى العاملة التقديري',
    peakWorkforce: 'ذروة القوى العاملة',
    internalNotes: 'ملاحظات داخلية',
    publicNotes: 'ملاحظات عامة',
    address: 'عنوان الموقع',
    city: 'المدينة',
    country: 'الدولة',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    siteArea: 'مساحة الموقع (م2)',
    projectDirector: 'مدير المشروع العام',
    projectManager: 'مدير المشروع',
    constructionManager: 'مدير الإنشاء',
    leadEngineer: 'المهندس الرئيسي',
    structuralEngineer: 'مهندس إنشائي',
    mepEngineer: 'مهندس MEP',
    qaManager: 'مدير ضمان الجودة',
    qcInspector: 'مفتش ضبط الجودة',
    commercialManager: 'مدير الشؤون التجارية',
    procurementLead: 'مسؤول المشتريات',
    structureType: 'نوع الهيكل الإنشائي',
    primaryMaterial: 'المادة الرئيسية',
    foundationType: 'نوع الأساس',
    soilClassification: 'تصنيف التربة',
    numberOfFloors: 'عدد الطوابق',
    totalBuiltArea: 'إجمالي المساحة المبنية (م2)',
    basementLevels: 'عدد مستويات القبو',
    designStage: 'مرحلة التصميم',
    designStandard: 'معيار التصميم',
    architectFirm: 'المكتب المعماري',
    plannedStartDate: 'تاريخ البدء المخطط',
    plannedFinishDate: 'تاريخ الانتهاء المخطط',
    actualStartDate: 'تاريخ البدء الفعلي',
    workingDaysPerWeek: 'أيام العمل في الأسبوع',
    publicHolidayCalendar: 'تقويم العطلات الرسمية',
    shiftPattern: 'نمط الورديات',
    dailyWorkHours: 'ساعات العمل اليومية',
    nightShiftEnabled: 'تفعيل الوردية الليلية',
    progressMeasurementMethod: 'طريقة قياس التقدم',
    reportingFrequency: 'تكرار التقارير',
    delayAnalysisEnabled: 'تفعيل تحليل التأخير',
    criticalPathMonitoring: 'تفعيل مراقبة المسار الحرج',
    region: 'المنطقة',
    timezone: 'المنطقة الزمنية',
    regulatoryRegion: 'المنطقة التنظيمية',
    constructionType: 'نوع الإنشاء',
    selectedStandards: 'المعايير المحددة',
    additionalStandards: 'معايير إضافية',
    customRegulatoryNote: 'إطار تنظيمي مخصص',
    customStandardNote: 'تفاصيل معيار مخصص',
    standardsCount: 'معايير',
    standardsFilterRegion: 'منطقة تصفية المعايير',
    safetyStandard: 'معيار السلامة',
    qualityStandard: 'معيار الجودة',
    environmentalStandard: 'المعيار البيئي',
    bimEnabled: 'تفعيل BIM',
    bimLevel: 'مستوى BIM',
    modelCoordinationRequired: 'اشتراط تنسيق النماذج',
    scheduleFileName: 'اسم ملف الجدول',
    validateScheduleOnUpload: 'التحقق من الجدول عند الرفع',
    autoLinkActivities: 'ربط الأنشطة تلقائياً',
    requireBaselineApproval: 'اشتراط اعتماد خط الأساس',
    contractDocumentsFile: 'ملف وثائق العقد',
    contractDocumentsNote: 'ملاحظة وثائق العقد',
    drawingsFile: 'ملف المخططات',
    drawingsNote: 'ملاحظة المخططات',
    specificationsFile: 'ملف المواصفات',
    specificationsNote: 'ملاحظة المواصفات',
    permitsFile: 'ملف التصاريح',
    permitsNote: 'ملاحظة التصاريح',
    currency: 'العملة',
    language: 'لغة المشروع',
    dateFormat: 'تنسيق التاريخ',
    weatherProvider: 'مزود بيانات الطقس',
    enableWeatherAlerts: 'تفعيل تنبيهات الطقس',
    enableSafetyDashboard: 'تفعيل لوحة السلامة',
    enableProgressDashboard: 'تفعيل لوحة التقدم',
    enableCostDashboard: 'تفعيل لوحة التكاليف',
    allowFieldReporting: 'السماح بالتقارير الميدانية',
    allowPhotoUpload: 'السماح برفع الصور',
    requireApprovalForReports: 'اشتراط اعتماد التقارير',
    interfaceLanguage: 'لغة الواجهة',
  },
  descriptions: {
    description: 'اكتب وصفاً مختصراً لنطاق المشروع.',
    contractValue: 'أدخل القيمة الإجمالية للعقد بالعملة المختارة.',
    siteArea: 'المساحة الإجمالية للموقع بالمتر المربع.',
    estimatedWorkforce: 'متوسط عدد الأفراد المتوقع في الموقع.',
    peakWorkforce: 'أقصى عدد متوقع من القوى العاملة أثناء الذروة.',
    latitude: 'إحداثي خط العرض (اختياري).',
    longitude: 'إحداثي خط الطول (اختياري).',
    dailyWorkHours: 'النطاق المسموح: من 1 إلى 24 ساعة يومياً.',
    scheduleFileName: 'اسم ملف الجدول الأساسي أو معرّف المرجع.',
    regulatoryRegion: 'يحدد الإطار التنظيمي للدولة. يتم تحميل المعايير تلقائياً.',
    constructionType: 'يحدد فئة المشروع لقواعد الامتثال المتخصصة.',
    additionalStandards: 'شهادات اختيارية بالإضافة إلى المجموعة التنظيمية المفعّلة تلقائياً.',
    customRegulatoryNote: 'صف الإطار التنظيمي المخصص عند اختيار منطقة «مخصص».',
    customStandardNote: 'صف المعايير المخصصة عند اختيار «مخصص» في المعايير الإضافية.',
    compliancePreviewEmpty: 'حدّد المنطقة التنظيمية ونوع الإنشاء لمعاينة المعايير المفعّلة.',
    complianceEngineNote: 'تُخزَّن هذه المعايير داخلياً ويستخدمها SitePilot AI للتقارير والسلامة والجودة والجدولة وتحليل المخاطر.',
    complianceCustomEmpty: 'لا توجد معايير تلقائية للمنطقة المخصصة — أضف ملاحظات ومعايير إضافية اختيارية.',
    aiContextPreview: 'سياق امتثال الذكاء الاصطناعي (داخلي)',
    standardsFilterRegion: 'تصفية قوائم المعايير حسب الولاية التنظيمية.',
    safetyStandard: 'المعيار الأساسي للسلامة المعتمد لفحوصات الامتثال.',
    qualityStandard: 'المعيار الأساسي للجودة لأعمال التنفيذ والتفتيش.',
    environmentalStandard: 'الإطار البيئي الأساسي للاستدامة والتصاريح.',
    bimEnabled: 'تفعيل التخطيط والضوابط المرتبطة بـ BIM.',
    modelCoordinationRequired: 'إلزام مراجعات تنسيق النماذج بين التخصصات.',
    validateScheduleOnUpload: 'تشغيل فحوصات آلية بعد رفع الجدول.',
    autoLinkActivities: 'مطابقة أنشطة الجدول تلقائياً مع حزم العمل.',
    requireBaselineApproval: 'قفل خط الأساس حتى الاعتماد الرسمي.',
    contractDocumentsNote: 'أضف ملاحظات على وثائق العقد.',
    drawingsNote: 'أضف ملاحظات عن إصدار المخططات وحالتها.',
    specificationsNote: 'أضف ملاحظات حول اكتمال المواصفات أو التعديلات.',
    permitsNote: 'أضف قيود التصاريح أو تواريخ الصلاحية.',
    enableWeatherAlerts: 'عرض تنبيهات مخاطر الطقس أثناء التشغيل اليومي.',
    enableSafetyDashboard: 'تفعيل مؤشرات السلامة وقياسات الحوادث.',
    enableProgressDashboard: 'تفعيل لوحات تقدم التنفيذ والأداء.',
    enableCostDashboard: 'تفعيل لوحة ملخص التكلفة وأداء الميزانية.',
    allowFieldReporting: 'السماح لفرق الموقع بإرسال تقارير يومية.',
    allowPhotoUpload: 'السماح بإرفاق صور إثبات داخل التقارير.',
    requireApprovalForReports: 'تمرير التقارير عبر سير اعتماد قبل النشر.',
    language: 'اللغة الافتراضية للمحتوى الذي ينتجه المشروع.',
    interfaceLanguage: 'اللغة المستخدمة أثناء تعبئة نموذج التهيئة.',
  },
  options: {
    projectTypes: {
      commercial: 'تجاري',
      residential: 'سكني',
      infrastructure: 'بنية تحتية',
      industrial: 'صناعي',
      healthcare: 'رعاية صحية',
      mixed_use: 'متعدد الاستخدامات',
    },
    projectStatuses: {
      planning: 'قيد التخطيط',
      active: 'نشط',
      on_hold: 'معلق',
      completed: 'مكتمل',
    },
    contractTypes: {
      lump_sum: 'مبلغ مقطوع',
      cost_plus: 'تكلفة زائد',
      guaranteed_maximum_price: 'سعر أقصى مضمون (GMP)',
      design_build: 'تصميم وتنفيذ',
      epc: 'هندسة وتوريد وإنشاء (EPC)',
      unit_price: 'سعر وحدات',
    },
    buildingClassifications: {
      class_a: 'الفئة A',
      class_b: 'الفئة B',
      class_c: 'الفئة C',
      special_purpose: 'غرض خاص',
    },
    projectPhases: {
      pre_construction: 'ما قبل الإنشاء',
      construction: 'الإنشاء',
      commissioning: 'التشغيل التجريبي',
      closeout: 'الإقفال',
    },
    sectors: {
      public: 'قطاع عام',
      private: 'قطاع خاص',
      ppp: 'شراكة بين القطاعين',
    },
    countries: {
      IR: 'إيران',
      AE: 'الإمارات العربية المتحدة',
      TR: 'تركيا',
      US: 'الولايات المتحدة',
      GB: 'المملكة المتحدة',
      DE: 'ألمانيا',
    },
    structureTypes: {
      concrete: 'خرسانة مسلحة',
      steel: 'فولاذ إنشائي',
      composite: 'مركب',
      timber: 'خشب',
      masonry: 'مباني طوبية',
    },
    foundationTypes: {
      shallow: 'أساس سطحي',
      deep_pile: 'أساس عميق بالأوتاد',
      raft: 'حصيرة (رافت)',
      caisson: 'قيسون',
    },
    soilClassifications: {
      rock: 'صخر',
      hard_clay: 'طين صلب',
      soft_clay: 'طين لين',
      sand: 'رمل',
      mixed: 'مختلط / غير معروف',
    },
    designStages: {
      concept: 'تصميم مفاهيمي',
      schematic: 'تصميم تخطيطي',
      detailed: 'تصميم تفصيلي',
      construction_docs: 'مستندات التنفيذ',
    },
    workingDays: {
      '5': '5 أيام / أسبوع',
      '6': '6 أيام / أسبوع',
      '7': '7 أيام / أسبوع',
    },
    holidayCalendars: {
      national: 'تقويم وطني',
      regional: 'تقويم إقليمي',
      custom: 'تقويم مشروع مخصص',
    },
    shiftPatterns: {
      single: 'وردية واحدة',
      double: 'ورديتان',
      triple: 'ثلاث ورديات',
      continuous: 'مستمر (24/7)',
    },
    progressMethods: {
      physical: 'تقدم مادي (%)',
      earned_value: 'القيمة المكتسبة',
      milestone: 'حسب المعالم',
      quantity: 'حسب الكميات',
    },
    reportingFrequencies: {
      daily: 'يومي',
      weekly: 'أسبوعي',
      biweekly: 'كل أسبوعين',
      monthly: 'شهري',
    },
    regions: {
      middle_east: 'الشرق الأوسط',
      europe: 'أوروبا',
      north_america: 'أمريكا الشمالية',
      asia_pacific: 'آسيا والمحيط الهادئ',
    },
    timezones: {
      'Asia/Tehran': 'Asia/Tehran (IRST)',
      'Asia/Dubai': 'Asia/Dubai (GST)',
      'Europe/London': 'Europe/London (GMT/BST)',
      'America/New_York': 'America/New_York (EST/EDT)',
    },
    regulatoryRegions: {
      germany: 'ألمانيا',
      european_union: 'الاتحاد الأوروبي',
      united_states: 'الولايات المتحدة',
      canada: 'كندا',
      iran: 'إيران',
      international: 'دولي',
      custom: 'مخصص',
    },
    constructionTypes: {
      general_building: 'مبنى عام',
      industrial_building: 'مبنى صناعي',
      industrial_plant: 'منشأة/مصنع صناعي',
      infrastructure: 'بنية تحتية',
      bridge: 'جسر',
      tunnel: 'نفق',
      railway: 'سكك حديدية',
      utility: 'مرافق / شبكات',
    },
    additionalStandards: {
      iso_9001: 'ISO 9001 — إدارة الجودة',
      iso_14001: 'ISO 14001 — الإدارة البيئية',
      iso_45001: 'ISO 45001 — الصحة والسلامة المهنية',
      iso_19650: 'ISO 19650 — إدارة معلومات BIM',
      leed: 'LEED — شهادة المباني الخضراء',
      breeam: 'BREEAM — تقييم الأثر البيئي للمباني',
      dgnb: 'DGNB — المجلس الألماني للمباني المستدامة',
      custom: 'معيار مخصص',
    },
    standardsRegions: {
      ALL: 'كل المناطق',
      US: 'الولايات المتحدة',
      CA: 'كندا',
      DE: 'ألمانيا',
      EU: 'أوروبا (الاتحاد الأوروبي / يوروكود)',
      IR: 'إيران',
      INTL: 'دولي',
    },
    bimLevels: {
      none: 'بدون BIM',
      level_1: 'BIM المستوى 1',
      level_2: 'BIM المستوى 2',
      level_3: 'BIM المستوى 3',
    },
    currencies: {
      USD: 'USD — دولار أمريكي',
      EUR: 'EUR — يورو',
      IRR: 'IRR — ريال إيراني',
      AED: 'AED — درهم إماراتي',
      GBP: 'GBP — جنيه إسترليني',
    },
    languages: {
      en: 'الإنجليزية',
      ar: 'العربية',
      fa: 'الفارسية',
      de: 'الألمانية',
      fr: 'الفرنسية',
    },
    dateFormats: {
      'YYYY-MM-DD': 'YYYY-MM-DD',
      'DD/MM/YYYY': 'DD/MM/YYYY',
      'MM/DD/YYYY': 'MM/DD/YYYY',
    },
    weatherProviders: {
      openweather: 'OpenWeather',
      weatherapi: 'WeatherAPI',
      manual: 'إدخال يدوي فقط',
    },
  },
  standardRegionGroups: {
    US: 'الولايات المتحدة',
    CA: 'كندا',
    DE: 'ألمانيا',
    EU: 'أوروبا (الاتحاد الأوروبي / يوروكود)',
    IR: 'إيران',
    INTL: 'دولي',
    ALL: 'كل المناطق',
  },
  standards,
  validation: {
    selectLanguage: 'يرجى اختيار لغة المشروع.',
    projectNameRequired: 'اسم المشروع مطلوب.',
    projectCodeRequired: 'رمز المشروع مطلوب.',
    projectTypeRequired: 'نوع المشروع مطلوب.',
    statusRequired: 'حالة المشروع مطلوبة.',
    clientNameRequired: 'اسم العميل مطلوب.',
    contractTypeRequired: 'نوع العقد مطلوب.',
    buildingClassificationRequired: 'تصنيف المبنى مطلوب.',
    projectPhaseRequired: 'مرحلة المشروع مطلوبة.',
    addressRequired: 'عنوان الموقع مطلوب.',
    cityRequired: 'المدينة مطلوبة.',
    countryRequired: 'الدولة مطلوبة.',
    projectManagerRequired: 'مدير المشروع مطلوب.',
    structureTypeRequired: 'نوع الهيكل الإنشائي مطلوب.',
    foundationTypeRequired: 'نوع الأساس مطلوب.',
    designStageRequired: 'مرحلة التصميم مطلوبة.',
    plannedStartRequired: 'تاريخ البدء المخطط مطلوب.',
    plannedFinishRequired: 'تاريخ الانتهاء المخطط مطلوب.',
    workingDaysRequired: 'عدد أيام العمل مطلوب.',
    holidayCalendarRequired: 'تقويم العطلات مطلوب.',
    shiftPatternRequired: 'نمط الورديات مطلوب.',
    dailyWorkHoursMin: 'ساعات العمل اليومية يجب ألا تقل عن 1.',
    dailyWorkHoursMax: 'ساعات العمل اليومية يجب ألا تتجاوز 24.',
    progressMethodRequired: 'طريقة قياس التقدم مطلوبة.',
    reportingFrequencyRequired: 'تكرار التقارير مطلوب.',
    regionRequired: 'المنطقة مطلوبة.',
    timezoneRequired: 'المنطقة الزمنية مطلوبة.',
    regulatoryRegionRequired: 'المنطقة التنظيمية مطلوبة.',
    constructionTypeRequired: 'نوع الإنشاء مطلوب.',
    safetyStandardRequired: 'معيار السلامة مطلوب.',
    currencyRequired: 'العملة مطلوبة.',
    languageRequired: 'اللغة مطلوبة.',
    dateFormatRequired: 'تنسيق التاريخ مطلوب.',
    weatherProviderRequired: 'مزود الطقس مطلوب.',
    finishDateAfterStart: 'يجب أن يكون تاريخ الانتهاء في نفس يوم البدء أو بعده.',
    invalidEmail: 'يرجى إدخال بريد إلكتروني صالح.',
  },
}
