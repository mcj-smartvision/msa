import { CONSTRUCTION_STANDARDS } from '../../standards-catalog'
import type { FormDictionary } from '../types'

function translateStandardDe(label: string): string {
  return label
    .replace('Occupational Health & Safety', 'Arbeitsschutz und Arbeitssicherheit')
    .replace('Quality Management', 'Qualitatsmanagement')
    .replace('Environmental Management', 'Umweltmanagement')
    .replace('Energy Management', 'Energiemanagement')
    .replace('BIM / Information Management', 'BIM / Informationsmanagement')
    .replace('Open BIM Data Model', 'Offenes BIM-Datenmodell')
    .replace('Construction Safety', 'Bausicherheit')
    .replace('General Industry', 'Allgemeine Industrie')
    .replace('Occupational Safety Guidelines', 'Arbeitsschutzrichtlinien')
    .replace('OHS Management Systems', 'Arbeitsschutz-Managementsysteme')
    .replace('Electrical Safety in Workplace', 'Elektrische Sicherheit am Arbeitsplatz')
    .replace('Life Safety Code', 'Lebensschutz-Norm')
    .replace('Mine Safety (when applicable)', 'Bergbausicherheit (falls anwendbar)')
    .replace('International Building Code', 'Internationaler Baucode')
    .replace('International Residential Code', 'Internationaler Wohnbaucode')
    .replace('International Energy Conservation Code', 'Internationaler Energieeffizienzcode')
    .replace('International Mechanical Code', 'Internationaler TGA-Code')
    .replace('International Plumbing Code', 'Internationaler Sanitrcode')
    .replace('International Fire Code', 'Internationaler Brandschutzcode')
    .replace('American Society for Testing & Materials', 'Amerikanische Gesellschaft fur Prufung und Materialien')
    .replace('Structural Concrete', 'Stahlbeton')
    .replace('Structural Steel Buildings', 'Stahltragwerke fur Gebaude')
    .replace('Minimum Design Loads', 'Mindestlasten fur die Tragwerksplanung')
    .replace('Highway & Bridge Design', 'Planung von Strassen und Brucken')
    .replace('National Electrical Safety Code', 'Nationale Norm fur elektrische Sicherheit')
    .replace('Product Safety Certification', 'Produktsicherheitszertifizierung')
    .replace('Environmental Protection', 'Umweltschutz')
    .replace('Green Building Certification', 'Zertifizierung fur nachhaltiges Bauen')
    .replace('WELL Building Standard', 'WELL-Gebaudestandard')
    .replace('Energy Standard for Buildings', 'Energiestandard fur Gebaude')
    .replace('Hazardous Sites', 'Gefahrstoffstandorte')
    .replace('OHS Management', 'Arbeitsschutzmanagement')
    .replace('OHS Training', 'Arbeitsschutzschulung')
    .replace('Canadian Centre for OHS', 'Kanadisches Zentrum fur Arbeitsschutz')
    .replace('Act Respecting OHS', 'Gesetz zum Arbeitsschutz')
    .replace('National Building Code of Canada', 'Nationaler Baucode Kanadas')
    .replace('National Fire Code of Canada', 'Nationaler Brandschutzcode Kanadas')
    .replace('National Plumbing Code of Canada', 'Nationaler Sanitrcode Kanadas')
    .replace('Concrete Materials & Construction', 'Betonbaustoffe und Ausfuhrung')
    .replace('Design of Steel Structures', 'Bemessung von Stahltragwerken')
    .replace('Engineering Design in Wood', 'Ingenieurholzbau')
    .replace('Accessible Design for Built Environment', 'Barrierefreies Planen in der bebauten Umwelt')
    .replace('Building Code (Provincial)', 'Bauordnung (Provinz)')
    .replace('Canadian Environmental Protection Act', 'Kanadisches Umweltschutzgesetz')
    .replace('Building Environmental Standards', 'Umweltstandards fur Gebaude')
    .replace('National Energy Code of Canada for Buildings', 'Nationaler Energiecode Kanadas fur Gebaude')
    .replace('German Social Accident Insurance Rules', 'Regelwerk der Deutschen Gesetzlichen Unfallversicherung')
    .replace('Technical Rules for Operational Safety', 'Technische Regeln fur Betriebssicherheit')
    .replace('Trade Association Safety Rules', 'Sicherheitsregeln der Berufsgenossenschaften')
    .replace('Hazardous Substances Ordinance', 'Gefahrstoffverordnung')
    .replace('DIN Standards — Deutsches Institut für Normung', 'DIN-Normen — Deutsches Institut fur Normung')
    .replace('German Construction Contract Procedures', 'Deutsche Vergabe- und Vertragsordnung fur Bauleistungen')
    .replace('General Contract Conditions for Construction', 'Allgemeine Vertragsbedingungen fur Bauleistungen')
    .replace('Model Building Code (Musterbauordnung)', 'Musterbauordnung')
    .replace('Concrete Structures', 'Betontragwerke')
    .replace('Steel & Aluminium Structures', 'Stahl- und Aluminiumtragwerke')
    .replace('Electrical Standards', 'Elektrotechnische Normen')
    .replace('Thermal Protection in Buildings', 'Warmeschutz im Hochbau')
    .replace('Sound Insulation in Buildings', 'Schallschutz im Hochbau')
    .replace('Federal Immission Control Act', 'Bundes-Immissionsschutzgesetz')
    .replace('German Sustainable Building Council', 'Deutsche Gesellschaft fur Nachhaltiges Bauen')
    .replace('Efficiency House Standards', 'Effizienzhaus-Standards')
    .replace('Building Energy Act (Gebäudeenergiegesetz)', 'Gebaudeenergiegesetz')
    .replace('EU Framework Directive 89/391/EEC — OHS', 'EU-Rahmenrichtlinie 89/391/EWG — Arbeitsschutz')
    .replace('EU Directive 92/57/EEC — Temporary/Mobile Construction Sites', 'EU-Richtlinie 92/57/EWG — Temporare/mobile Baustellen')
    .replace('EU Machinery Directive 2006/42/EC', 'EU-Maschinenrichtlinie 2006/42/EG')
    .replace('EU REACH — Chemical Substances Regulation', 'EU REACH — Chemikalienverordnung')
    .replace('UK HSE CDM Regulations 2015', 'UK HSE CDM-Verordnung 2015')
    .replace('France INRS — OHS Reference', 'Frankreich INRS — Arbeitsschutzreferenz')
    .replace('Eurocode: Basis of Structural Design', 'Eurocode: Grundlagen der Tragwerksplanung')
    .replace('Eurocode 1: Actions on Structures', 'Eurocode 1: Einwirkungen auf Tragwerke')
    .replace('Eurocode 2: Concrete Structures', 'Eurocode 2: Betontragwerke')
    .replace('Eurocode 3: Steel Structures', 'Eurocode 3: Stahltragwerke')
    .replace('Eurocode 4: Composite Structures', 'Eurocode 4: Verbundtragwerke')
    .replace('Eurocode 5: Timber Structures', 'Eurocode 5: Holztragwerke')
    .replace('Eurocode 6: Masonry Structures', 'Eurocode 6: Mauerwerksbau')
    .replace('Eurocode 7: Geotechnical Design', 'Eurocode 7: Geotechnische Bemessung')
    .replace('Eurocode 8: Seismic Design', 'Eurocode 8: Erdbebenbemessung')
    .replace('Eurocode 9: Aluminium Structures', 'Eurocode 9: Aluminiumtragwerke')
    .replace('Construction Products Regulation', 'Bauproduktenverordnung')
    .replace('Safety Rules for Lifts', 'Sicherheitsregeln fur Aufzuge')
    .replace('British Adopted European Standards', 'Britisch ubernommene europaische Normen')
    .replace('Eco-Management & Audit Scheme', 'Umweltmanagement- und Auditsystem')
    .replace('Building Research Environmental Assessment', 'Umweltbewertung fur Bauwerke')
    .replace('Energy Performance of Buildings Directive', 'Richtlinie uber die Gesamtenergieeffizienz von Gebauden')
    .replace('Waste Framework Directive 2008/98/EC', 'Abfallrahmenrichtlinie 2008/98/EG')
    .replace('Water Framework Directive 2000/60/EC', 'Wasserrahmenrichtlinie 2000/60/EG')
    .replace('Iran HSE Regulations — Ministry of Labour', 'Iranische HSE-Vorschriften — Arbeitsministerium')
    .replace('Iran Construction Site Safety Bylaws', 'Iranische Sicherheitsvorschriften fur Baustellen')
    .replace('Iran Fire Safety & Emergency Regulations', 'Iranische Brandschutz- und Notfallvorschriften')
    .replace('Iran Electrical Safety Code (IEEE-IR adapted)', 'Iranischer Code fur elektrische Sicherheit (IEEE-IR adaptiert)')
    .replace('Iran National Building Regulations (Melli)', 'Iranische nationale Bauvorschriften (Melli)')
    .replace('Iran Standard 2800 — Seismic Design of Buildings', 'Iran-Standard 2800 — Erdbebenbemessung von Gebauden')
    .replace('Iran Standard 413 — Concrete Structures (Aba)', 'Iran-Standard 413 — Betontragwerke (Aba)')
    .replace('Iran Standard 414 — Steel Structures Design', 'Iran-Standard 414 — Bemessung von Stahltragwerken')
    .replace('Development Plan — Construction Requirements', 'Entwicklungsplan — Bauanforderungen')
    .replace('Tehran / Municipal Building Codes', 'Teheraner / kommunale Bauordnungen')
    .replace('Iran Road & Highway Construction Standards', 'Iranische Standards fur Strassen- und Autobahnbau')
    .replace('Institute of Standards & Industrial Research', 'Institut fur Normung und industrielle Forschung')
    .replace('Iran Environmental Protection Law', 'Iranisches Umweltschutzgesetz')
    .replace('Iran Wastewater Discharge Standards', 'Iranische Normen fur Abwassereinleitung')
    .replace('Iran Air Quality & Emissions Standards', 'Iranische Luftqualitats- und Emissionsstandards')
    .replace('Iran Energy Efficiency in Buildings Directive', 'Iranische Richtlinie zur Energieeffizienz in Gebauden')
}

const standards = Object.fromEntries(
  CONSTRUCTION_STANDARDS.map((standard) => [standard.value, translateStandardDe(standard.label)])
)

export const de: FormDictionary = {
  ui: {
    back: 'Zuruck',
    next: 'Weiter',
    submit: 'Projekt erstellen',
    step: 'Schritt',
    stepOf: 'von',
    selectPlaceholder: 'Option auswahlen',
    fixErrors: 'Bitte korrigieren Sie die markierten Felder, bevor Sie fortfahren.',
    successMessage: 'Die Projektinitialisierung wurde erfolgreich abgeschlossen.',
    successTitle: 'Projekt registriert',
    successDescription: 'Ihr Projekt wurde gespeichert.',
    goToProjects: 'Zu Projekten',
    registerAnother: 'Weiteres Projekt registrieren',
    countrySearchPlaceholder: 'Land eingeben…',
    selected: 'Ausgewahlt',
    languageHint: 'Wahlen Sie die Formularsprache fur diese Projekteinrichtung.',
    mandatoryStandard: 'Pflicht',
    selectMandatoryOnly: 'Nur Pflicht',
    selectAllStandards: 'Alle auswahlen',
    addCustomStandard: 'Standard hinzufugen',
    removeCustomStandard: 'Entfernen',
    catalogStandards: 'Katalog',
    customStandardsShort: 'eigen',
    customStandardCodePlaceholder: 'z. B. DIN 1234',
    customStandardNamePlaceholder: 'Vollstandiger Standardtitel',
    customStandardDescPlaceholder: 'Optionale Hinweise fur KI-Compliance-Prufungen',
    showOnMap: 'Auf Karte anzeigen',
    mapSearching: 'Suche…',
    mapLoading: 'Karte wird geladen…',
    mapAddressPlaceholder: 'Adresse eingeben…',
  },
  steps: {
    language: { title: 'Sprache', description: 'Primare Sprache fur die Projekteinrichtung auswahlen.' },
    projectInfo: { title: 'Projektinformationen', description: 'Projektstammdaten, Kundendaten, Vertrag und Standort erfassen.' },
    projectTeam: { title: 'Projektteam', description: 'Management-, Engineering-, QA/QC- und kaufmannische Rollen zuweisen.' },
    technicalInfo: { title: 'Technische Informationen', description: 'Tragwerk, Geotechnik und Planungsstand definieren.' },
    scheduleHours: { title: 'Terminplan & Arbeitszeiten', description: 'Basisdaten, Kalender, Schichten und Fortschrittssteuerung festlegen.' },
    standardsLocation: { title: 'Bau-Compliance', description: 'Regulierungsregion, Bauart und automatisch aktivierte Standards konfigurieren.' },
    scheduleUpload: { title: 'Terminplan-Upload', description: 'Basis-Terminplan und Validierungsregeln bereitstellen.' },
    projectDocuments: { title: 'Projektdokumente', description: 'Vertrags-, Plan-, Spezifikations- und Genehmigungsunterlagen hochladen.' },
    projectSettings: { title: 'Projekteinstellungen', description: 'Lokalisierung, Wetterdienst, Dashboards und Berechtigungen festlegen.' },
  },
  subsections: {
    basicInfo: 'Grundinformationen',
    client: 'Auftraggeber',
    organization: 'Organisation',
    contract: 'Vertrag',
    classification: 'Klassifizierung',
    workforce: 'Personal',
    notes: 'Notizen',
    location: 'Standort',
    management: 'Management',
    engineering: 'Engineering',
    qa: 'QA / QC',
    commercial: 'Kaufmannisch',
    structure: 'Tragwerk',
    foundation: 'Grundung',
    buildingInfo: 'Gebaudeinformationen',
    designInfo: 'Planungsinformationen',
    dates: 'Termine',
    calendar: 'Kalender',
    shiftHours: 'Schicht- und Arbeitszeiten',
    progressSettings: 'Fortschrittseinstellungen',
    delayAnalysis: 'Verzogerungsanalyse',
    region: 'Region',
    complianceFramework: 'Compliance-Rahmenwerk',
    projectStandards: 'Projektstandards',
    activatedStandards: 'Automatisch aktivierte Standards',
    additionalStandards: 'Zusatzstandards',
    standards: 'Normen',
    bimSettings: 'BIM-Einstellungen',
    regionalSettings: 'Regionale Einstellungen',
    weatherProvider: 'Wetteranbieter',
    dashboardModules: 'Dashboard-Module',
    permissions: 'Berechtigungen',
    contractDocuments: 'Vertragsunterlagen',
    drawings: 'Plane',
    specifications: 'Spezifikationen',
    permits: 'Genehmigungen',
  },
  sections: {
    language: { title: 'Sprache', description: 'Sprache fur diesen Einrichtungsassistenten festlegen.' },
    projectInfo: { title: 'Projektinformationen', description: 'Projektstammdaten, Stakeholder, Vertrag und Standort.' },
    projectTeam: { title: 'Projektteam', description: 'Verantwortliche Rollen und Schlusselpositionen.' },
    technicalInfo: { title: 'Technische Informationen', description: 'Tragwerkssystem und Planungsreife.' },
    scheduleHours: { title: 'Terminplan & Arbeitszeiten', description: 'Termine, Verfugbarkeit und Berichtsintervall.' },
    standardsLocation: {
      title: 'Bau-Compliance',
      description: 'Regulierungsregion und Bauart wahlen. Pflichtstandards werden automatisch erkannt; optionale Standards konnen erganzt oder entfernt werden.',
    },
    scheduleUpload: { title: 'Terminplan-Upload', description: 'Terminplan importieren und automatisch prufen.' },
    projectDocuments: { title: 'Projektdokumente', description: 'Referenzdokumente fur die Projektausfuhrung.' },
    projectSettings: { title: 'Projekteinstellungen', description: 'Standardwerte, Dashboards und Berichtsrechte.' },
  },
  fields: {
    projectName: 'Projektname',
    projectCode: 'Projektcode',
    projectType: 'Projektart',
    status: 'Projektstatus',
    description: 'Projektbeschreibung',
    clientName: 'Name des Auftraggebers',
    clientContact: 'Ansprechpartner beim Auftraggeber',
    clientEmail: 'E-Mail des Auftraggebers',
    clientPhone: 'Telefon des Auftraggebers',
    organizationName: 'Organisationsname',
    department: 'Abteilung',
    contractType: 'Vertragsart',
    contractNumber: 'Vertragsnummer',
    contractValue: 'Vertragswert',
    contractStartDate: 'Vertragsbeginn',
    contractEndDate: 'Vertragsende',
    buildingClassification: 'Gebaudeklassifizierung',
    projectPhase: 'Projektphase',
    sector: 'Sektor',
    estimatedWorkforce: 'Geschatzte Personalstarke',
    peakWorkforce: 'Maximale Personalstarke',
    internalNotes: 'Interne Notizen',
    publicNotes: 'Offentliche Notizen',
    address: 'Baustellenadresse',
    city: 'Stadt',
    country: 'Land',
    latitude: 'Breitengrad',
    longitude: 'Langengrad',
    siteArea: 'Grundstucksflache (m2)',
    projectDirector: 'Projektleiter (Direktion)',
    projectManager: 'Projektmanager',
    constructionManager: 'Bauleiter',
    leadEngineer: 'Leitender Ingenieur',
    structuralEngineer: 'Tragwerksplaner',
    mepEngineer: 'TGA-Ingenieur',
    qaManager: 'QA-Manager',
    qcInspector: 'QC-Inspektor',
    commercialManager: 'Kaufmannischer Leiter',
    procurementLead: 'Leitung Einkauf',
    structureType: 'Tragwerksart',
    primaryMaterial: 'Hauptmaterial',
    foundationType: 'Grundungsart',
    soilClassification: 'Bodenklassifizierung',
    numberOfFloors: 'Anzahl der Geschosse',
    totalBuiltArea: 'Gesamte Bruttogrundflache (m2)',
    basementLevels: 'Anzahl Untergeschosse',
    designStage: 'Planungsphase',
    designStandard: 'Planungsnorm',
    architectFirm: 'Architekturburo',
    plannedStartDate: 'Geplanter Starttermin',
    plannedFinishDate: 'Geplanter Fertigstellungstermin',
    actualStartDate: 'Tatsachlicher Starttermin',
    workingDaysPerWeek: 'Arbeitstage pro Woche',
    publicHolidayCalendar: 'Feiertagskalender',
    shiftPattern: 'Schichtmodell',
    dailyWorkHours: 'Tagliche Arbeitsstunden',
    nightShiftEnabled: 'Nachtschicht aktivieren',
    progressMeasurementMethod: 'Fortschrittsmessmethode',
    reportingFrequency: 'Berichtshaufigkeit',
    delayAnalysisEnabled: 'Verzogerungsanalyse aktivieren',
    criticalPathMonitoring: 'Uberwachung des kritischen Pfads aktivieren',
    region: 'Region',
    timezone: 'Zeitzone',
    regulatoryRegion: 'Regulierungsregion',
    constructionType: 'Bauart',
    selectedStandards: 'Ausgewahlte Standards',
    additionalStandards: 'Zusatzstandards',
    customRegulatoryNote: 'Individuelles Regelwerk',
    customStandardNote: 'Individuelle Standarddetails',
    standardsCount: 'Standards',
    standardsFilterRegion: 'Regionenfilter fur Normen',
    safetyStandard: 'Sicherheitsnorm',
    qualityStandard: 'Qualitatsnorm',
    environmentalStandard: 'Umweltnorm',
    bimEnabled: 'BIM aktiviert',
    bimLevel: 'BIM-Level',
    modelCoordinationRequired: 'Modellkoordination erforderlich',
    scheduleFileName: 'Dateiname Terminplan',
    validateScheduleOnUpload: 'Terminplan beim Upload validieren',
    autoLinkActivities: 'Aktivitaten automatisch verknupfen',
    requireBaselineApproval: 'Freigabe der Baseline erforderlich',
    contractDocumentsFile: 'Datei Vertragsunterlagen',
    contractDocumentsNote: 'Notiz Vertragsunterlagen',
    drawingsFile: 'Datei Plane',
    drawingsNote: 'Notiz Plane',
    specificationsFile: 'Datei Spezifikationen',
    specificationsNote: 'Notiz Spezifikationen',
    permitsFile: 'Datei Genehmigungen',
    permitsNote: 'Notiz Genehmigungen',
    currency: 'Wahrung',
    language: 'Projektsprache',
    dateFormat: 'Datumsformat',
    weatherProvider: 'Wetteranbieter',
    enableWeatherAlerts: 'Wetterwarnungen aktivieren',
    enableSafetyDashboard: 'Sicherheits-Dashboard aktivieren',
    enableProgressDashboard: 'Fortschritts-Dashboard aktivieren',
    enableCostDashboard: 'Kosten-Dashboard aktivieren',
    allowFieldReporting: 'Baustellenberichte erlauben',
    allowPhotoUpload: 'Foto-Upload erlauben',
    requireApprovalForReports: 'Freigabe fur Berichte erforderlich',
    interfaceLanguage: 'Oberflachensprache',
  },
  descriptions: {
    description: 'Geben Sie eine kurze Leistungsbeschreibung fur dieses Projekt an.',
    contractValue: 'Gesamtvertragswert in der gewahlten Projektwahrung eingeben.',
    siteArea: 'Gesamte Flache des Projektstandorts in Quadratmetern.',
    estimatedWorkforce: 'Durchschnittlich erwartete Personalanzahl auf der Baustelle.',
    peakWorkforce: 'Maximal erwartete Personalanzahl in der Hochphase.',
    latitude: 'Optionaler geografischer Breitengrad.',
    longitude: 'Optionaler geografischer Langengrad.',
    dailyWorkHours: 'Zulassiger Bereich: 1 bis 24 Stunden pro Tag.',
    scheduleFileName: 'Dateiname oder Referenz des Basis-Terminplans.',
    regulatoryRegion: 'Bestimmt das landesspezifische Regelwerk. Standards werden automatisch geladen.',
    constructionType: 'Bestimmt die Projektkategorie fur fachspezifische Compliance-Regeln.',
    additionalStandards: 'Optionale Zertifizierungen uber das automatisch aktivierte Regelwerk hinaus.',
    customRegulatoryNote: 'Beschreiben Sie das individuelle Regelwerk, wenn die Region „Individuell“ gewahlt ist.',
    customStandardNote: 'Beschreiben Sie individuelle Standards, wenn „Individuell“ bei Zusatzstandards gewahlt ist.',
    compliancePreviewEmpty: 'Regulierungsregion und Bauart wahlen, um aktivierte Standards anzuzeigen.',
    complianceEngineNote: 'Diese Standards werden intern gespeichert und von SitePilot AI fur Berichte, Sicherheit, Qualitat, Terminplan und Risikoanalyse genutzt.',
    complianceCustomEmpty: 'Keine automatischen Standards fur individuelle Region — Notizen und optionale Zusatzstandards erganzen.',
    aiContextPreview: 'AI-Compliance-Kontext (intern)',
    standardsFilterRegion: 'Filtert die Normlisten nach Rechtsraum.',
    safetyStandard: 'Primare Sicherheitsnorm fur Compliance-Prufungen.',
    qualityStandard: 'Primare Qualitatsnorm fur Bau- und Prufprozesse.',
    environmentalStandard: 'Primarer Umweltstandard fur Nachhaltigkeit und Genehmigungen.',
    bimEnabled: 'Aktiviert BIM-bezogene Planung und Steuerung.',
    modelCoordinationRequired: 'Interdisziplinare Modellkoordination verbindlich machen.',
    validateScheduleOnUpload: 'Automatische Prufung nach dem Upload des Terminplans.',
    autoLinkActivities: 'Terminplanaktivitaten automatisch Arbeitspaketen zuordnen.',
    requireBaselineApproval: 'Baseline bleibt bis zur Freigabe gesperrt.',
    contractDocumentsNote: 'Bemerkungen zu Vertragsunterlagen erfassen.',
    drawingsNote: 'Hinweise zu Planstand, Revision oder Status erfassen.',
    specificationsNote: 'Hinweise zu Vollstandigkeit oder Revision der Spezifikationen erfassen.',
    permitsNote: 'Auflagen, Gultigkeit oder behordliche Hinweise erfassen.',
    enableWeatherAlerts: 'Wetterrisikowarnungen im Tagesbetrieb anzeigen.',
    enableSafetyDashboard: 'Sicherheits-KPIs und Vorfallmetriken aktivieren.',
    enableProgressDashboard: 'Fortschritts- und Leistungsansichten aktivieren.',
    enableCostDashboard: 'Kostenubersicht und Budgetperformance aktivieren.',
    allowFieldReporting: 'Ermoglicht Baustellenpersonal das Einreichen von Tagesberichten.',
    allowPhotoUpload: 'Bildnachweise in Berichten zulassen.',
    requireApprovalForReports: 'Berichte vor Freigabe durch Genehmigungsworkflow leiten.',
    language: 'Standardsprache fur projekterzeugte Inhalte.',
    interfaceLanguage: 'Sprache fur das Ausfullen dieses Initialisierungsformulars.',
  },
  options: {
    projectTypes: {
      commercial: 'Gewerbe',
      residential: 'Wohnbau',
      infrastructure: 'Infrastruktur',
      industrial: 'Industrie',
      healthcare: 'Gesundheitswesen',
      mixed_use: 'Mischnutzung',
    },
    projectStatuses: {
      planning: 'In Planung',
      active: 'Aktiv',
      on_hold: 'Pausiert',
      completed: 'Abgeschlossen',
    },
    contractTypes: {
      lump_sum: 'Pauschalpreis',
      cost_plus: 'Kosten plus',
      guaranteed_maximum_price: 'Garantierter Hochstpreis (GMP)',
      design_build: 'Planen und Bauen',
      epc: 'EPC',
      unit_price: 'Einheitspreis',
    },
    buildingClassifications: {
      class_a: 'Klasse A',
      class_b: 'Klasse B',
      class_c: 'Klasse C',
      special_purpose: 'Sonderbau',
    },
    projectPhases: {
      pre_construction: 'Vorbereitung',
      construction: 'Ausfuhrung',
      commissioning: 'Inbetriebnahme',
      closeout: 'Projektabschluss',
    },
    sectors: {
      public: 'Offentlicher Sektor',
      private: 'Privater Sektor',
      ppp: 'Offentlich-private Partnerschaft',
    },
    countries: {
      IR: 'Iran',
      AE: 'Vereinigte Arabische Emirate',
      TR: 'Turkei',
      US: 'Vereinigte Staaten',
      GB: 'Vereinigtes Konigreich',
      DE: 'Deutschland',
    },
    structureTypes: {
      concrete: 'Stahlbeton',
      steel: 'Stahltragwerk',
      composite: 'Verbundbau',
      timber: 'Holzbau',
      masonry: 'Mauerwerk',
    },
    foundationTypes: {
      shallow: 'Flachgrundung',
      deep_pile: 'Tiefgrundung mit Pfahlen',
      raft: 'Plattengrundung',
      caisson: 'Senkkasten',
    },
    soilClassifications: {
      rock: 'Fels',
      hard_clay: 'Harter Ton',
      soft_clay: 'Weicher Ton',
      sand: 'Sand',
      mixed: 'Gemischt / Unbekannt',
    },
    designStages: {
      concept: 'Konzeptplanung',
      schematic: 'Entwurfsplanung',
      detailed: 'Ausfuhrungsplanung',
      construction_docs: 'Ausschreibungs- und Ausfuhrungsunterlagen',
    },
    workingDays: {
      '5': '5 Tage / Woche',
      '6': '6 Tage / Woche',
      '7': '7 Tage / Woche',
    },
    holidayCalendars: {
      national: 'Nationaler Kalender',
      regional: 'Regionaler Kalender',
      custom: 'Projektspezifischer Kalender',
    },
    shiftPatterns: {
      single: 'Einzelschicht',
      double: 'Zweischicht',
      triple: 'Dreischicht',
      continuous: 'Kontinuierlich (24/7)',
    },
    progressMethods: {
      physical: 'Physischer Fortschritt (%)',
      earned_value: 'Earned Value',
      milestone: 'Meilensteinbasiert',
      quantity: 'Mengenbasiert',
    },
    reportingFrequencies: {
      daily: 'Taglich',
      weekly: 'Wochentlich',
      biweekly: '14-tagig',
      monthly: 'Monatlich',
    },
    regions: {
      middle_east: 'Naher Osten',
      europe: 'Europa',
      north_america: 'Nordamerika',
      asia_pacific: 'Asien-Pazifik',
    },
    timezones: {
      'Asia/Tehran': 'Asia/Tehran (IRST)',
      'Asia/Dubai': 'Asia/Dubai (GST)',
      'Europe/London': 'Europe/London (GMT/BST)',
      'America/New_York': 'America/New_York (EST/EDT)',
    },
    regulatoryRegions: {
      germany: 'Deutschland',
      european_union: 'Europaische Union',
      united_states: 'Vereinigte Staaten',
      canada: 'Kanada',
      iran: 'Iran',
      international: 'International',
      custom: 'Individuell',
    },
    constructionTypes: {
      general_building: 'Allgemeines Gebaude',
      industrial_building: 'Industriegebaude',
      industrial_plant: 'Industrieanlage',
      infrastructure: 'Infrastruktur',
      bridge: 'Brucke',
      tunnel: 'Tunnel',
      railway: 'Eisenbahn',
      utility: 'Versorgungsanlage',
    },
    additionalStandards: {
      iso_9001: 'ISO 9001 — Qualitatsmanagement',
      iso_14001: 'ISO 14001 — Umweltmanagement',
      iso_45001: 'ISO 45001 — Arbeitsschutz und Arbeitssicherheit',
      iso_19650: 'ISO 19650 — BIM / Informationsmanagement',
      leed: 'LEED — Zertifizierung fur nachhaltiges Bauen',
      breeam: 'BREEAM — Umweltbewertung fur Bauwerke',
      dgnb: 'DGNB — Deutsche Gesellschaft fur Nachhaltiges Bauen',
      custom: 'Individueller Standard',
    },
    standardsRegions: {
      ALL: 'Alle Regionen',
      US: 'Vereinigte Staaten',
      CA: 'Kanada',
      DE: 'Deutschland',
      EU: 'Europa (EU / Eurocodes)',
      IR: 'Iran',
      INTL: 'International',
    },
    bimLevels: {
      none: 'Kein BIM',
      level_1: 'BIM Level 1',
      level_2: 'BIM Level 2',
      level_3: 'BIM Level 3',
    },
    currencies: {
      USD: 'USD — US-Dollar',
      EUR: 'EUR — Euro',
      IRR: 'IRR — Iranischer Rial',
      AED: 'AED — VAE-Dirham',
      GBP: 'GBP — Britisches Pfund',
    },
    languages: {
      en: 'Englisch',
      ar: 'Arabisch',
      fa: 'Persisch',
      de: 'Deutsch',
      fr: 'Franzosisch',
    },
    dateFormats: {
      'YYYY-MM-DD': 'YYYY-MM-DD',
      'DD/MM/YYYY': 'DD/MM/YYYY',
      'MM/DD/YYYY': 'MM/DD/YYYY',
    },
    weatherProviders: {
      openweather: 'OpenWeather',
      weatherapi: 'WeatherAPI',
      manual: 'Nur manuelle Eingabe',
    },
  },
  standardRegionGroups: {
    US: 'Vereinigte Staaten',
    CA: 'Kanada',
    DE: 'Deutschland',
    EU: 'Europa (EU / Eurocodes)',
    IR: 'Iran',
    INTL: 'International',
    ALL: 'Alle Regionen',
  },
  standards,
  validation: {
    selectLanguage: 'Bitte wahlen Sie eine Projektsprache aus.',
    projectNameRequired: 'Projektname ist erforderlich.',
    projectCodeRequired: 'Projektcode ist erforderlich.',
    projectTypeRequired: 'Projektart ist erforderlich.',
    statusRequired: 'Status ist erforderlich.',
    clientNameRequired: 'Name des Auftraggebers ist erforderlich.',
    contractTypeRequired: 'Vertragsart ist erforderlich.',
    buildingClassificationRequired: 'Gebaudeklassifizierung ist erforderlich.',
    projectPhaseRequired: 'Projektphase ist erforderlich.',
    addressRequired: 'Baustellenadresse ist erforderlich.',
    cityRequired: 'Stadt ist erforderlich.',
    countryRequired: 'Land ist erforderlich.',
    projectManagerRequired: 'Projektmanager ist erforderlich.',
    structureTypeRequired: 'Tragwerksart ist erforderlich.',
    foundationTypeRequired: 'Grundungsart ist erforderlich.',
    designStageRequired: 'Planungsphase ist erforderlich.',
    plannedStartRequired: 'Geplanter Starttermin ist erforderlich.',
    plannedFinishRequired: 'Geplanter Endtermin ist erforderlich.',
    workingDaysRequired: 'Arbeitstage pro Woche sind erforderlich.',
    holidayCalendarRequired: 'Feiertagskalender ist erforderlich.',
    shiftPatternRequired: 'Schichtmodell ist erforderlich.',
    dailyWorkHoursMin: 'Tagliche Arbeitsstunden mussen mindestens 1 betragen.',
    dailyWorkHoursMax: 'Tagliche Arbeitsstunden durfen 24 nicht uberschreiten.',
    progressMethodRequired: 'Fortschrittsmessmethode ist erforderlich.',
    reportingFrequencyRequired: 'Berichtshaufigkeit ist erforderlich.',
    regionRequired: 'Region ist erforderlich.',
    timezoneRequired: 'Zeitzone ist erforderlich.',
    regulatoryRegionRequired: 'Regulierungsregion ist erforderlich.',
    constructionTypeRequired: 'Bauart ist erforderlich.',
    safetyStandardRequired: 'Sicherheitsnorm ist erforderlich.',
    currencyRequired: 'Wahrung ist erforderlich.',
    languageRequired: 'Sprache ist erforderlich.',
    dateFormatRequired: 'Datumsformat ist erforderlich.',
    weatherProviderRequired: 'Wetteranbieter ist erforderlich.',
    finishDateAfterStart: 'Enddatum muss am oder nach dem Startdatum liegen.',
    invalidEmail: 'Bitte geben Sie eine gultige E-Mail-Adresse ein.',
  },
}
