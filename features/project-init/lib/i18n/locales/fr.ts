import { CONSTRUCTION_STANDARDS } from '../../standards-catalog'
import type { FormDictionary } from '../types'

function translateStandardFr(label: string): string {
  return label
    .replace('Occupational Health & Safety', 'Sante et securite au travail')
    .replace('Quality Management', 'Management de la qualite')
    .replace('Environmental Management', 'Management environnemental')
    .replace('Energy Management', 'Management de l energie')
    .replace('BIM / Information Management', 'BIM / Gestion de l information')
    .replace('Open BIM Data Model', 'Modele de donnees BIM ouvert')
    .replace('Construction Safety', 'Securite des chantiers')
    .replace('General Industry', 'Industrie generale')
    .replace('Occupational Safety Guidelines', 'Lignes directrices de securite au travail')
    .replace('OHS Management Systems', 'Systemes de management SST')
    .replace('Electrical Safety in Workplace', 'Securite electrique sur le lieu de travail')
    .replace('Life Safety Code', 'Code de securite des personnes')
    .replace('Mine Safety (when applicable)', 'Securite miniere (si applicable)')
    .replace('International Building Code', 'Code international du batiment')
    .replace('International Residential Code', 'Code international du batiment residentiel')
    .replace('International Energy Conservation Code', 'Code international de conservation de l energie')
    .replace('International Mechanical Code', 'Code international mecanique')
    .replace('International Plumbing Code', 'Code international de plomberie')
    .replace('International Fire Code', 'Code international de prevention incendie')
    .replace('American Society for Testing & Materials', 'Societe americaine des essais et materiaux')
    .replace('Structural Concrete', 'Beton structurel')
    .replace('Structural Steel Buildings', 'Batiments a structure acier')
    .replace('Minimum Design Loads', 'Charges minimales de conception')
    .replace('Highway & Bridge Design', 'Conception de routes et de ponts')
    .replace('National Electrical Safety Code', 'Code national de securite electrique')
    .replace('Product Safety Certification', 'Certification de securite des produits')
    .replace('Environmental Protection', 'Protection de l environnement')
    .replace('Green Building Certification', 'Certification batiment durable')
    .replace('WELL Building Standard', 'Standard WELL du batiment')
    .replace('Energy Standard for Buildings', 'Norme energetique pour les batiments')
    .replace('Hazardous Sites', 'Sites dangereux')
    .replace('OHS Management', 'Management SST')
    .replace('OHS Training', 'Formation SST')
    .replace('Canadian Centre for OHS', 'Centre canadien de sante et securite au travail')
    .replace('Act Respecting OHS', 'Loi relative a la SST')
    .replace('National Building Code of Canada', 'Code national du batiment du Canada')
    .replace('National Fire Code of Canada', 'Code national de prevention incendie du Canada')
    .replace('National Plumbing Code of Canada', 'Code national de plomberie du Canada')
    .replace('Concrete Materials & Construction', 'Materiaux et construction en beton')
    .replace('Design of Steel Structures', 'Conception des structures en acier')
    .replace('Engineering Design in Wood', 'Conception d ingenierie en bois')
    .replace('Accessible Design for Built Environment', 'Conception accessible de l environnement bati')
    .replace('Building Code (Provincial)', 'Code du batiment (provincial)')
    .replace('Canadian Environmental Protection Act', 'Loi canadienne sur la protection de l environnement')
    .replace('Building Environmental Standards', 'Normes environnementales du batiment')
    .replace('National Energy Code of Canada for Buildings', 'Code national de l energie pour les batiments au Canada')
    .replace('German Social Accident Insurance Rules', 'Regles allemandes d assurance accidents')
    .replace('Technical Rules for Operational Safety', 'Regles techniques de securite operationnelle')
    .replace('Trade Association Safety Rules', 'Regles de securite des associations professionnelles')
    .replace('Hazardous Substances Ordinance', 'Reglement sur les substances dangereuses')
    .replace('German Construction Contract Procedures', 'Procedures contractuelles allemandes de construction')
    .replace('General Contract Conditions for Construction', 'Conditions generales de contrat pour la construction')
    .replace('Model Building Code (Musterbauordnung)', 'Code modele du batiment (Musterbauordnung)')
    .replace('Concrete Structures', 'Structures en beton')
    .replace('Steel & Aluminium Structures', 'Structures en acier et aluminium')
    .replace('Electrical Standards', 'Normes electriques')
    .replace('Thermal Protection in Buildings', 'Protection thermique des batiments')
    .replace('Sound Insulation in Buildings', 'Isolation acoustique des batiments')
    .replace('Federal Immission Control Act', 'Loi federale de controle des emissions')
    .replace('German Sustainable Building Council', 'Conseil allemand du batiment durable')
    .replace('Efficiency House Standards', 'Normes de performance energetique des batiments')
    .replace('Building Energy Act (Gebäudeenergiegesetz)', 'Loi energie des batiments')
    .replace('EU Framework Directive 89/391/EEC — OHS', 'Directive-cadre UE 89/391/CEE — SST')
    .replace('EU Directive 92/57/EEC — Temporary/Mobile Construction Sites', 'Directive UE 92/57/CEE — Chantiers temporaires ou mobiles')
    .replace('EU Machinery Directive 2006/42/EC', 'Directive Machines UE 2006/42/CE')
    .replace('EU REACH — Chemical Substances Regulation', 'UE REACH — Reglement des substances chimiques')
    .replace('UK HSE CDM Regulations 2015', 'Reglementation britannique CDM 2015')
    .replace('France INRS — OHS Reference', 'France INRS — Reference SST')
    .replace('Eurocode: Basis of Structural Design', 'Eurocode : bases de calcul des structures')
    .replace('Eurocode 1: Actions on Structures', 'Eurocode 1 : actions sur les structures')
    .replace('Eurocode 2: Concrete Structures', 'Eurocode 2 : structures en beton')
    .replace('Eurocode 3: Steel Structures', 'Eurocode 3 : structures en acier')
    .replace('Eurocode 4: Composite Structures', 'Eurocode 4 : structures mixtes')
    .replace('Eurocode 5: Timber Structures', 'Eurocode 5 : structures en bois')
    .replace('Eurocode 6: Masonry Structures', 'Eurocode 6 : structures en maconnerie')
    .replace('Eurocode 7: Geotechnical Design', 'Eurocode 7 : conception geotechnique')
    .replace('Eurocode 8: Seismic Design', 'Eurocode 8 : conception sismique')
    .replace('Eurocode 9: Aluminium Structures', 'Eurocode 9 : structures en aluminium')
    .replace('Construction Products Regulation', 'Reglement produits de construction')
    .replace('Safety Rules for Lifts', 'Regles de securite pour ascenseurs')
    .replace('British Adopted European Standards', 'Normes europeennes adoptees au Royaume-Uni')
    .replace('Eco-Management & Audit Scheme', 'Systeme de management et d audit environnemental')
    .replace('Building Research Environmental Assessment', 'Methode d evaluation environnementale des batiments')
    .replace('Energy Performance of Buildings Directive', 'Directive sur la performance energetique des batiments')
    .replace('Waste Framework Directive 2008/98/EC', 'Directive-cadre dechets 2008/98/CE')
    .replace('Water Framework Directive 2000/60/EC', 'Directive-cadre sur l eau 2000/60/CE')
    .replace('Iran HSE Regulations — Ministry of Labour', 'Reglementation SST iranienne — Ministere du Travail')
    .replace('Iran Construction Site Safety Bylaws', 'Regles iraniennes de securite des chantiers')
    .replace('Iran Fire Safety & Emergency Regulations', 'Regles iraniennes de securite incendie et d urgence')
    .replace('Iran Electrical Safety Code (IEEE-IR adapted)', 'Code iranien de securite electrique (adapte IEEE-IR)')
    .replace('Iran National Building Regulations (Melli)', 'Reglements nationaux iraniens du batiment (Melli)')
    .replace('Iran Standard 2800 — Seismic Design of Buildings', 'Norme iranienne 2800 — Conception sismique des batiments')
    .replace('Iran Standard 413 — Concrete Structures (Aba)', 'Norme iranienne 413 — Structures en beton (Aba)')
    .replace('Iran Standard 414 — Steel Structures Design', 'Norme iranienne 414 — Conception des structures en acier')
    .replace('Development Plan — Construction Requirements', 'Plan de developpement — Exigences de construction')
    .replace('Tehran / Municipal Building Codes', 'Codes de construction municipaux de Teheran')
    .replace('Iran Road & Highway Construction Standards', 'Normes iraniennes de construction de routes et autoroutes')
    .replace('Institute of Standards & Industrial Research', 'Institut des normes et de la recherche industrielle')
    .replace('Iran Environmental Protection Law', 'Loi iranienne sur la protection de l environnement')
    .replace('Iran Wastewater Discharge Standards', 'Normes iraniennes de rejet des eaux usees')
    .replace('Iran Air Quality & Emissions Standards', 'Normes iraniennes de qualite de l air et emissions')
    .replace('Iran Energy Efficiency in Buildings Directive', 'Directive iranienne d efficacite energetique des batiments')
}

const standards = Object.fromEntries(
  CONSTRUCTION_STANDARDS.map((standard) => [standard.value, translateStandardFr(standard.label)])
)

export const fr: FormDictionary = {
  ui: {
    back: 'Retour',
    next: 'Suivant',
    submit: 'Creer le projet',
    step: 'Etape',
    stepOf: 'sur',
    selectPlaceholder: 'Selectionner une option',
    fixErrors: 'Veuillez corriger les champs en erreur avant de continuer.',
    successMessage: 'Initialisation du projet terminee avec succes.',
    successTitle: 'Projet enregistre',
    successDescription: 'Votre projet a ete enregistre.',
    goToProjects: 'Voir les projets',
    registerAnother: 'Enregistrer un autre projet',
    countrySearchPlaceholder: 'Tapez le pays…',
    selected: 'Selectionne',
    languageHint: 'Choisissez la langue du formulaire pour cette configuration de projet.',
    mandatoryStandard: 'Obligatoire',
    selectMandatoryOnly: 'Obligatoires uniquement',
    selectAllStandards: 'Tout selectionner',
    addCustomStandard: 'Ajouter une norme',
    removeCustomStandard: 'Supprimer',
    catalogStandards: 'catalogue',
    customStandardsShort: 'personnalise',
    customStandardCodePlaceholder: 'ex. NF 1234',
    customStandardNamePlaceholder: 'Titre complet de la norme',
    customStandardDescPlaceholder: 'Notes optionnelles pour les controles IA',
    showOnMap: 'Afficher sur la carte',
    mapSearching: 'Recherche…',
    mapLoading: 'Chargement de la carte…',
    mapAddressPlaceholder: 'Saisir une adresse…',
  },
  steps: {
    language: { title: 'Langue', description: 'Selectionnez la langue principale de configuration du projet.' },
    projectInfo: { title: 'Informations du projet', description: 'Renseignez l identite du projet, le client, le contrat et le site.' },
    projectTeam: { title: 'Equipe projet', description: 'Affectez les roles management, ingenierie, QA/QC et commercial.' },
    technicalInfo: { title: 'Informations techniques', description: 'Definissez la structure, le sol et l avancement de conception.' },
    scheduleHours: { title: 'Planning et horaires', description: 'Configurez les dates de reference, le calendrier, les shifts et le suivi.' },
    standardsLocation: { title: 'Conformite construction', description: 'Region reglementaire, type de construction et standards auto-actives.' },
    scheduleUpload: { title: 'Import du planning', description: 'Televersez le planning de base et les regles de validation.' },
    projectDocuments: { title: 'Documents projet', description: 'Televersez contrats, plans, specifications et permis.' },
    projectSettings: { title: 'Parametres projet', description: 'Choisissez localisation, meteo, tableaux de bord et permissions.' },
  },
  subsections: {
    basicInfo: 'Informations de base',
    client: 'Client',
    organization: 'Organisation',
    contract: 'Contrat',
    classification: 'Classification',
    workforce: 'Main-d oeuvre',
    notes: 'Notes',
    location: 'Localisation',
    management: 'Management',
    engineering: 'Ingenierie',
    qa: 'QA / QC',
    commercial: 'Commercial',
    structure: 'Structure',
    foundation: 'Fondations',
    buildingInfo: 'Informations batiment',
    designInfo: 'Informations de conception',
    dates: 'Dates',
    calendar: 'Calendrier',
    shiftHours: 'Shifts et horaires',
    progressSettings: 'Parametres de progression',
    delayAnalysis: 'Analyse des retards',
    region: 'Region',
    complianceFramework: 'Cadre de conformite',
    projectStandards: 'Standards du projet',
    activatedStandards: 'Standards auto-actives',
    additionalStandards: 'Standards complementaires',
    standards: 'Normes',
    bimSettings: 'Parametres BIM',
    regionalSettings: 'Parametres regionaux',
    weatherProvider: 'Fournisseur meteo',
    dashboardModules: 'Modules de tableau de bord',
    permissions: 'Permissions',
    contractDocuments: 'Documents contractuels',
    drawings: 'Plans',
    specifications: 'Specifications',
    permits: 'Permis',
  },
  sections: {
    language: { title: 'Langue', description: 'Definit la langue utilisee dans cet assistant.' },
    projectInfo: { title: 'Informations du projet', description: 'Metadonnees projet, parties prenantes, contrat et implantation.' },
    projectTeam: { title: 'Equipe projet', description: 'Responsables et roles clefs de livraison.' },
    technicalInfo: { title: 'Informations techniques', description: 'Systeme structurel et niveau de maturite des etudes.' },
    scheduleHours: { title: 'Planning et horaires', description: 'Dates, disponibilite et frequence de reporting.' },
    standardsLocation: {
      title: 'Conformite construction',
      description: 'Selectionnez la region reglementaire et le type de construction. Les standards obligatoires sont detectes automatiquement ; ajoutez ou retirez les options selon vos besoins.',
    },
    scheduleUpload: { title: 'Import du planning', description: 'Importer et verifier automatiquement le planning.' },
    projectDocuments: { title: 'Documents projet', description: 'Documents de reference pour l execution.' },
    projectSettings: { title: 'Parametres projet', description: 'Valeurs par defaut operationnelles et droits de reporting.' },
  },
  fields: {
    projectName: 'Nom du projet',
    projectCode: 'Code projet',
    projectType: 'Type de projet',
    status: 'Statut du projet',
    description: 'Description du projet',
    clientName: 'Nom du client',
    clientContact: 'Contact client',
    clientEmail: 'E-mail client',
    clientPhone: 'Telephone client',
    organizationName: 'Nom de l organisation',
    department: 'Departement',
    contractType: 'Type de contrat',
    contractNumber: 'Numero de contrat',
    contractValue: 'Valeur du contrat',
    contractStartDate: 'Date de debut du contrat',
    contractEndDate: 'Date de fin du contrat',
    buildingClassification: 'Classification du batiment',
    projectPhase: 'Phase du projet',
    sector: 'Secteur',
    estimatedWorkforce: 'Effectif estime',
    peakWorkforce: 'Effectif de pointe',
    internalNotes: 'Notes internes',
    publicNotes: 'Notes publiques',
    address: 'Adresse du site',
    city: 'Ville',
    country: 'Pays',
    latitude: 'Latitude',
    longitude: 'Longitude',
    siteArea: 'Surface du site (m2)',
    projectDirector: 'Directeur de projet',
    projectManager: 'Chef de projet',
    constructionManager: 'Responsable travaux',
    leadEngineer: 'Ingenieur principal',
    structuralEngineer: 'Ingenieur structure',
    mepEngineer: 'Ingenieur CVC/MEP',
    qaManager: 'Responsable QA',
    qcInspector: 'Inspecteur QC',
    commercialManager: 'Responsable commercial',
    procurementLead: 'Responsable achats',
    structureType: 'Type de structure',
    primaryMaterial: 'Materiau principal',
    foundationType: 'Type de fondation',
    soilClassification: 'Classification du sol',
    numberOfFloors: 'Nombre de niveaux',
    totalBuiltArea: 'Surface construite totale (m2)',
    basementLevels: 'Niveaux de sous-sol',
    designStage: 'Phase de conception',
    designStandard: 'Norme de conception',
    architectFirm: 'Agence d architecture',
    plannedStartDate: 'Date de debut planifiee',
    plannedFinishDate: 'Date de fin planifiee',
    actualStartDate: 'Date de debut reelle',
    workingDaysPerWeek: 'Jours travailles par semaine',
    publicHolidayCalendar: 'Calendrier des jours feries',
    shiftPattern: 'Modele de shift',
    dailyWorkHours: 'Heures de travail quotidiennes',
    nightShiftEnabled: 'Activer le shift de nuit',
    progressMeasurementMethod: 'Methode de mesure de l avancement',
    reportingFrequency: 'Frequence de reporting',
    delayAnalysisEnabled: 'Activer l analyse des retards',
    criticalPathMonitoring: 'Activer le suivi du chemin critique',
    region: 'Region',
    timezone: 'Fuseau horaire',
    regulatoryRegion: 'Region reglementaire',
    constructionType: 'Type de construction',
    selectedStandards: 'Standards selectionnes',
    additionalStandards: 'Standards complementaires',
    customRegulatoryNote: 'Cadre reglementaire personnalise',
    customStandardNote: 'Details de standard personnalise',
    standardsCount: 'standards',
    standardsFilterRegion: 'Region de filtrage des normes',
    safetyStandard: 'Norme securite',
    qualityStandard: 'Norme qualite',
    environmentalStandard: 'Norme environnementale',
    bimEnabled: 'BIM active',
    bimLevel: 'Niveau BIM',
    modelCoordinationRequired: 'Coordination des modeles requise',
    scheduleFileName: 'Nom du fichier planning',
    validateScheduleOnUpload: 'Valider le planning au televersement',
    autoLinkActivities: 'Lier automatiquement les activites',
    requireBaselineApproval: 'Exiger l approbation de la baseline',
    contractDocumentsFile: 'Fichier documents contractuels',
    contractDocumentsNote: 'Note documents contractuels',
    drawingsFile: 'Fichier plans',
    drawingsNote: 'Note plans',
    specificationsFile: 'Fichier specifications',
    specificationsNote: 'Note specifications',
    permitsFile: 'Fichier permis',
    permitsNote: 'Note permis',
    currency: 'Devise',
    language: 'Langue du projet',
    dateFormat: 'Format de date',
    weatherProvider: 'Fournisseur meteo',
    enableWeatherAlerts: 'Activer les alertes meteo',
    enableSafetyDashboard: 'Activer le tableau securite',
    enableProgressDashboard: 'Activer le tableau avancement',
    enableCostDashboard: 'Activer le tableau couts',
    allowFieldReporting: 'Autoriser le reporting terrain',
    allowPhotoUpload: 'Autoriser le televersement de photos',
    requireApprovalForReports: 'Exiger l approbation des rapports',
    interfaceLanguage: 'Langue de l interface',
  },
  descriptions: {
    description: 'Ajoutez un resume concis du perimetre du projet.',
    contractValue: 'Indiquez le montant total du contrat dans la devise choisie.',
    siteArea: 'Superficie totale de l emprise du projet en metres carres.',
    estimatedWorkforce: 'Effectif moyen prevu sur le chantier.',
    peakWorkforce: 'Effectif maximal prevu au pic des travaux.',
    latitude: 'Coordonnee de latitude optionnelle.',
    longitude: 'Coordonnee de longitude optionnelle.',
    dailyWorkHours: 'Plage autorisee : de 1 a 24 heures par jour.',
    scheduleFileName: 'Nom ou reference du fichier planning de base.',
    regulatoryRegion: 'Determine le cadre reglementaire national. Les standards sont charges automatiquement.',
    constructionType: 'Determine la categorie de projet pour les regles de conformite specifiques.',
    additionalStandards: 'Certifications optionnelles au-dela du jeu reglementaire auto-active.',
    customRegulatoryNote: 'Decrivez le cadre reglementaire personnalise lorsque la region « Personnalise » est selectionnee.',
    customStandardNote: 'Decrivez les standards personnalises lorsque « Personnalise » est selectionne dans les standards complementaires.',
    compliancePreviewEmpty: 'Selectionnez la region reglementaire et le type de construction pour previsualiser les standards actives.',
    complianceEngineNote: 'Ces standards sont stockes en interne et utilises par SitePilot AI pour les rapports, la securite, la qualite, le planning et l analyse des risques.',
    complianceCustomEmpty: 'Aucun standard automatique pour une region personnalisee — ajoutez des notes et des standards complementaires.',
    aiContextPreview: 'Contexte de conformite IA (interne)',
    standardsFilterRegion: 'Filtre les normes selon la juridiction.',
    safetyStandard: 'Norme principale de securite pour les controles de conformite.',
    qualityStandard: 'Norme principale de qualite pour travaux et inspections.',
    environmentalStandard: 'Referentiel environnemental principal pour durabilite et permis.',
    bimEnabled: 'Active la planification et les controles lies au BIM.',
    modelCoordinationRequired: 'Impose des revues de coordination inter-disciplines.',
    validateScheduleOnUpload: 'Lance des controles automatiques apres import du planning.',
    autoLinkActivities: 'Associe automatiquement les activites aux lots du projet.',
    requireBaselineApproval: 'Verrouille la baseline jusqu a validation formelle.',
    contractDocumentsNote: 'Ajoutez des remarques sur les documents contractuels.',
    drawingsNote: 'Ajoutez des notes sur les plans (version, revision, statut).',
    specificationsNote: 'Ajoutez des notes sur les specifications (completude, revisions).',
    permitsNote: 'Ajoutez des contraintes ou dates de validite des permis.',
    enableWeatherAlerts: 'Affiche les alertes meteo de risque operationnel.',
    enableSafetyDashboard: 'Active les KPI securite et incidents.',
    enableProgressDashboard: 'Active les vues d avancement et de performance.',
    enableCostDashboard: 'Active les vues budget et couts.',
    allowFieldReporting: 'Permet aux equipes chantier de soumettre des rapports.',
    allowPhotoUpload: 'Permet d ajouter des preuves photo aux rapports.',
    requireApprovalForReports: 'Soumet les rapports a un workflow d approbation.',
    language: 'Langue par defaut des contenus generes pour le projet.',
    interfaceLanguage: 'Langue utilisee pendant ce formulaire d initialisation.',
  },
  options: {
    projectTypes: {
      commercial: 'Commercial',
      residential: 'Residentiel',
      infrastructure: 'Infrastructure',
      industrial: 'Industriel',
      healthcare: 'Sante',
      mixed_use: 'Usage mixte',
    },
    projectStatuses: {
      planning: 'Planification',
      active: 'Actif',
      on_hold: 'En pause',
      completed: 'Termine',
    },
    contractTypes: {
      lump_sum: 'Forfait',
      cost_plus: 'Cout majoré',
      guaranteed_maximum_price: 'Prix maximum garanti (GMP)',
      design_build: 'Conception-realisation',
      epc: 'EPC',
      unit_price: 'Prix unitaire',
    },
    buildingClassifications: {
      class_a: 'Classe A',
      class_b: 'Classe B',
      class_c: 'Classe C',
      special_purpose: 'Usage specifique',
    },
    projectPhases: {
      pre_construction: 'Pre-construction',
      construction: 'Construction',
      commissioning: 'Mise en service',
      closeout: 'Cloture',
    },
    sectors: {
      public: 'Secteur public',
      private: 'Secteur prive',
      ppp: 'Partenariat public-prive',
    },
    countries: {
      IR: 'Iran',
      AE: 'Emirats arabes unis',
      TR: 'Turquie',
      US: 'Etats-Unis',
      GB: 'Royaume-Uni',
      DE: 'Allemagne',
    },
    structureTypes: {
      concrete: 'Beton arme',
      steel: 'Acier de structure',
      composite: 'Composite',
      timber: 'Bois',
      masonry: 'Maconnerie',
    },
    foundationTypes: {
      shallow: 'Fondation superficielle',
      deep_pile: 'Fondation profonde sur pieux',
      raft: 'Radier',
      caisson: 'Caisson',
    },
    soilClassifications: {
      rock: 'Roche',
      hard_clay: 'Argile dure',
      soft_clay: 'Argile molle',
      sand: 'Sable',
      mixed: 'Mixte / Inconnu',
    },
    designStages: {
      concept: 'Conception conceptuelle',
      schematic: 'Conception schematique',
      detailed: 'Conception detaillee',
      construction_docs: 'Documents d execution',
    },
    workingDays: {
      '5': '5 jours / semaine',
      '6': '6 jours / semaine',
      '7': '7 jours / semaine',
    },
    holidayCalendars: {
      national: 'Calendrier national',
      regional: 'Calendrier regional',
      custom: 'Calendrier projet personnalise',
    },
    shiftPatterns: {
      single: 'Un shift',
      double: 'Deux shifts',
      triple: 'Trois shifts',
      continuous: 'Continu (24/7)',
    },
    progressMethods: {
      physical: 'Avancement physique (%)',
      earned_value: 'Valeur acquise',
      milestone: 'Par jalons',
      quantity: 'Base quantites',
    },
    reportingFrequencies: {
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      biweekly: 'Bimensuel',
      monthly: 'Mensuel',
    },
    regions: {
      middle_east: 'Moyen-Orient',
      europe: 'Europe',
      north_america: 'Amerique du Nord',
      asia_pacific: 'Asie-Pacifique',
    },
    timezones: {
      'Asia/Tehran': 'Asia/Tehran (IRST)',
      'Asia/Dubai': 'Asia/Dubai (GST)',
      'Europe/London': 'Europe/London (GMT/BST)',
      'America/New_York': 'America/New_York (EST/EDT)',
    },
    regulatoryRegions: {
      germany: 'Allemagne',
      european_union: 'Union europeenne',
      united_states: 'Etats-Unis',
      canada: 'Canada',
      iran: 'Iran',
      international: 'International',
      custom: 'Personnalise',
    },
    constructionTypes: {
      general_building: 'Batiment general',
      industrial_building: 'Batiment industriel',
      industrial_plant: 'Installation industrielle',
      infrastructure: 'Infrastructure',
      bridge: 'Pont',
      tunnel: 'Tunnel',
      railway: 'Ferroviaire',
      utility: 'Utilite / reseaux',
    },
    additionalStandards: {
      iso_9001: 'ISO 9001 — Management de la qualite',
      iso_14001: 'ISO 14001 — Management environnemental',
      iso_45001: 'ISO 45001 — Sante et securite au travail',
      iso_19650: 'ISO 19650 — BIM / Gestion de l information',
      leed: 'LEED — Certification batiment durable',
      breeam: 'BREEAM — Evaluation environnementale des batiments',
      dgnb: 'DGNB — Conseil allemand du batiment durable',
      custom: 'Standard personnalise',
    },
    standardsRegions: {
      ALL: 'Toutes les regions',
      US: 'Etats-Unis',
      CA: 'Canada',
      DE: 'Allemagne',
      EU: 'Europe (UE / Eurocodes)',
      IR: 'Iran',
      INTL: 'International',
    },
    bimLevels: {
      none: 'Sans BIM',
      level_1: 'BIM Niveau 1',
      level_2: 'BIM Niveau 2',
      level_3: 'BIM Niveau 3',
    },
    currencies: {
      USD: 'USD — Dollar americain',
      EUR: 'EUR — Euro',
      IRR: 'IRR — Rial iranien',
      AED: 'AED — Dirham EAU',
      GBP: 'GBP — Livre sterling',
    },
    languages: {
      en: 'Anglais',
      ar: 'Arabe',
      fa: 'Persan',
      de: 'Allemand',
      fr: 'Francais',
    },
    dateFormats: {
      'YYYY-MM-DD': 'YYYY-MM-DD',
      'DD/MM/YYYY': 'DD/MM/YYYY',
      'MM/DD/YYYY': 'MM/DD/YYYY',
    },
    weatherProviders: {
      openweather: 'OpenWeather',
      weatherapi: 'WeatherAPI',
      manual: 'Saisie manuelle uniquement',
    },
  },
  standardRegionGroups: {
    US: 'Etats-Unis',
    CA: 'Canada',
    DE: 'Allemagne',
    EU: 'Europe (UE / Eurocodes)',
    IR: 'Iran',
    INTL: 'International',
    ALL: 'Toutes les regions',
  },
  standards,
  validation: {
    selectLanguage: 'Veuillez selectionner une langue de projet.',
    projectNameRequired: 'Le nom du projet est obligatoire.',
    projectCodeRequired: 'Le code projet est obligatoire.',
    projectTypeRequired: 'Le type de projet est obligatoire.',
    statusRequired: 'Le statut est obligatoire.',
    clientNameRequired: 'Le nom du client est obligatoire.',
    contractTypeRequired: 'Le type de contrat est obligatoire.',
    buildingClassificationRequired: 'La classification du batiment est obligatoire.',
    projectPhaseRequired: 'La phase du projet est obligatoire.',
    addressRequired: 'L adresse du site est obligatoire.',
    cityRequired: 'La ville est obligatoire.',
    countryRequired: 'Le pays est obligatoire.',
    projectManagerRequired: 'Le chef de projet est obligatoire.',
    structureTypeRequired: 'Le type de structure est obligatoire.',
    foundationTypeRequired: 'Le type de fondation est obligatoire.',
    designStageRequired: 'La phase de conception est obligatoire.',
    plannedStartRequired: 'La date de debut planifiee est obligatoire.',
    plannedFinishRequired: 'La date de fin planifiee est obligatoire.',
    workingDaysRequired: 'Le nombre de jours travailles est obligatoire.',
    holidayCalendarRequired: 'Le calendrier des jours feries est obligatoire.',
    shiftPatternRequired: 'Le modele de shift est obligatoire.',
    dailyWorkHoursMin: 'Les heures quotidiennes doivent etre superieures ou egales a 1.',
    dailyWorkHoursMax: 'Les heures quotidiennes ne peuvent pas depasser 24.',
    progressMethodRequired: 'La methode de mesure de progression est obligatoire.',
    reportingFrequencyRequired: 'La frequence de reporting est obligatoire.',
    regionRequired: 'La region est obligatoire.',
    timezoneRequired: 'Le fuseau horaire est obligatoire.',
    regulatoryRegionRequired: 'La region reglementaire est obligatoire.',
    constructionTypeRequired: 'Le type de construction est obligatoire.',
    safetyStandardRequired: 'La norme de securite est obligatoire.',
    currencyRequired: 'La devise est obligatoire.',
    languageRequired: 'La langue est obligatoire.',
    dateFormatRequired: 'Le format de date est obligatoire.',
    weatherProviderRequired: 'Le fournisseur meteo est obligatoire.',
    finishDateAfterStart: 'La date de fin doit etre egale ou posterieure a la date de debut.',
    invalidEmail: 'Veuillez saisir une adresse e-mail valide.',
  },
}
