/**
 * Data-driven option lists for the Project Initialization Form.
 * Update these arrays to change dropdown values without touching UI components.
 */

export const PROJECT_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'mixed_use', label: 'Mixed Use' },
] as const

export const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
] as const

export const CONTRACT_TYPES = [
  { value: 'lump_sum', label: 'Lump Sum' },
  { value: 'cost_plus', label: 'Cost Plus' },
  { value: 'guaranteed_maximum_price', label: 'Guaranteed Maximum Price (GMP)' },
  { value: 'design_build', label: 'Design-Build' },
  { value: 'epc', label: 'EPC' },
  { value: 'unit_price', label: 'Unit Price' },
] as const

export const BUILDING_CLASSIFICATIONS = [
  { value: 'class_a', label: 'Class A' },
  { value: 'class_b', label: 'Class B' },
  { value: 'class_c', label: 'Class C' },
  { value: 'special_purpose', label: 'Special Purpose' },
] as const

export const PROJECT_PHASES = [
  { value: 'pre_construction', label: 'Pre-Construction' },
  { value: 'construction', label: 'Construction' },
  { value: 'commissioning', label: 'Commissioning' },
  { value: 'closeout', label: 'Closeout' },
] as const

export const SECTORS = [
  { value: 'public', label: 'Public Sector' },
  { value: 'private', label: 'Private Sector' },
  { value: 'ppp', label: 'Public-Private Partnership' },
] as const

export const COUNTRIES = [
  { value: 'IR', label: 'Iran' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'TR', label: 'Turkey' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
] as const

export const STRUCTURE_TYPES = [
  { value: 'concrete', label: 'Reinforced Concrete' },
  { value: 'steel', label: 'Structural Steel' },
  { value: 'composite', label: 'Composite' },
  { value: 'timber', label: 'Timber' },
  { value: 'masonry', label: 'Masonry' },
] as const

export const FOUNDATION_TYPES = [
  { value: 'shallow', label: 'Shallow Foundation' },
  { value: 'deep_pile', label: 'Deep Pile' },
  { value: 'raft', label: 'Raft Foundation' },
  { value: 'caisson', label: 'Caisson' },
] as const

export const SOIL_CLASSIFICATIONS = [
  { value: 'rock', label: 'Rock' },
  { value: 'hard_clay', label: 'Hard Clay' },
  { value: 'soft_clay', label: 'Soft Clay' },
  { value: 'sand', label: 'Sand' },
  { value: 'mixed', label: 'Mixed / Unknown' },
] as const

export const DESIGN_STAGES = [
  { value: 'concept', label: 'Concept Design' },
  { value: 'schematic', label: 'Schematic Design' },
  { value: 'detailed', label: 'Detailed Design' },
  { value: 'construction_docs', label: 'Construction Documents' },
] as const

export const WORKING_DAYS_OPTIONS = [
  { value: '5', label: '5 days / week' },
  { value: '6', label: '6 days / week' },
  { value: '7', label: '7 days / week' },
] as const

export const HOLIDAY_CALENDARS = [
  { value: 'national', label: 'National Calendar' },
  { value: 'regional', label: 'Regional Calendar' },
  { value: 'custom', label: 'Custom Project Calendar' },
] as const

export const SHIFT_PATTERNS = [
  { value: 'single', label: 'Single Shift' },
  { value: 'double', label: 'Double Shift' },
  { value: 'triple', label: 'Triple Shift' },
  { value: 'continuous', label: 'Continuous (24/7)' },
] as const

export const PROGRESS_METHODS = [
  { value: 'physical', label: 'Physical Progress (%)' },
  { value: 'earned_value', label: 'Earned Value' },
  { value: 'milestone', label: 'Milestone Based' },
  { value: 'quantity', label: 'Quantity Based' },
] as const

export const REPORTING_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const REGIONS = [
  { value: 'middle_east', label: 'Middle East' },
  { value: 'europe', label: 'Europe' },
  { value: 'north_america', label: 'North America' },
  { value: 'asia_pacific', label: 'Asia Pacific' },
] as const

export const TIMEZONES = [
  { value: 'Asia/Tehran', label: 'Asia/Tehran (IRST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
] as const

/** Full standards lists — see standards-catalog.ts */
export { STANDARDS_REGIONS, getStandardsByCategory, toGroupedSelectOptions, findStandard } from './standards-catalog'

export const BIM_LEVELS = [
  { value: 'none', label: 'No BIM' },
  { value: 'level_1', label: 'BIM Level 1' },
  { value: 'level_2', label: 'BIM Level 2' },
  { value: 'level_3', label: 'BIM Level 3' },
] as const

export const DOCUMENT_CATEGORIES = [
  { value: 'contract', label: 'Contract Documents' },
  { value: 'drawings', label: 'Drawings' },
  { value: 'specifications', label: 'Specifications' },
  { value: 'permits', label: 'Permits & Licenses' },
  { value: 'method_statements', label: 'Method Statements' },
  { value: 'hse_plans', label: 'HSE Plans' },
] as const

export const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'IRR', label: 'IRR — Iranian Rial' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'GBP', label: 'GBP — British Pound' },
] as const

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'fa', label: 'Persian (فارسی)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'fr', label: 'French (Français)' },
] as const

/** Languages shown on step 1 — same set as project settings */
export const INTERFACE_LANGUAGES = LANGUAGES

export const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
] as const

export const WEATHER_PROVIDERS = [
  { value: 'openweather', label: 'OpenWeather' },
  { value: 'weatherapi', label: 'WeatherAPI' },
  { value: 'manual', label: 'Manual Entry Only' },
] as const

export const FORM_STEPS = [
  { id: 0, key: 'projectInfo', title: 'Project Information', description: 'Basic details, client, contract, and location' },
  { id: 1, key: 'projectTeam', title: 'Project Team', description: 'Management, engineering, QA, and commercial roles' },
  { id: 2, key: 'technicalInfo', title: 'Technical Information', description: 'Structure, foundation, and design data' },
  { id: 3, key: 'scheduleHours', title: 'Schedule & Hours', description: 'Dates, calendar, shifts, and progress settings' },
  { id: 4, key: 'standardsLocation', title: 'Construction Compliance', description: 'Regulatory region, construction type, and auto-activated standards' },
  { id: 5, key: 'scheduleUpload', title: 'Schedule Upload', description: 'Baseline schedule file and validation rules' },
  { id: 6, key: 'projectDocuments', title: 'Project Documents', description: 'Upload categorized project files' },
  { id: 7, key: 'projectSettings', title: 'Project Settings', description: 'Regional, weather, dashboard, and permissions' },
] as const
