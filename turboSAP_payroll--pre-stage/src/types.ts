// Core data types for Payroll Area Configuration

export type PayFrequencyType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type CalendarPattern = 'mon-sun' | 'sun-sat' | 'custom';
export type PayDay = 'thursday' | 'friday' | 'current' | 'custom';
export type TimeZoneCode = 'ML' | 'HI' | 'PR' | 'IO'; // Mainland, Hawaii, Puerto Rico, International Office
export type TaskStatus = 'draft' | 'review' | 'approved';

export interface PayFrequency {
  type: PayFrequencyType;
  employeeCount: number;
  calendarPattern: CalendarPattern;
  payDay: PayDay;
  customPayDay?: string; // If payDay is 'custom'
}

export interface BusinessUnit {
  code: string; // "construction", "services", "corporate"
  name: string;
  employeeCount: number;
  requiresSeparateArea: boolean;
}

export interface TimeZone {
  code: TimeZoneCode;
  name: string;
  employeeCount: number;
  affectsProcessing: boolean; // Does time zone difference require separate area?
}

export interface Union {
  code: string; // "L11", "L39", etc.
  name: string;
  employeeCount: number;
  uniqueCalendar: boolean; // Does union require different pay calendar?
  uniqueFunding: boolean; // Does union require separate funding/tracking?
}

export interface CompanyProfile {
  companyId: string;
  companyName: string;
  totalEmployees: number;
  payFrequencies: PayFrequency[];
  businessUnits: BusinessUnit[];
  timeZones: TimeZone[];
  unions: Union[];
  securitySplitting: boolean; // Separate areas for security/access control?
}

export interface PayrollArea {
  code: string; // "WC", "WS", "BC11", etc.
  description: string;
  frequency: PayFrequencyType;
  calendarId: string; // "80", "20", "40", etc. (SAP calendar ID)
  businessUnit?: string;
  timeZone?: TimeZoneCode;
  union?: string; // Union code if applicable
  employeeCount: number;
  generatedBy?: 'system' | 'consultant'; // Was this auto-generated or manually added?
  reasoning: string[]; // Why this area was created (audit trail)
  // Additional fields from LangGraph backend
  periodPattern?: string; // "mon-sun", "sun-sat", etc.
  payDay?: string; // "friday", "thursday", etc.
  region?: string; // "mainland", "hawaii", etc.
}

export interface SAPCalendarRow {
  calendarId: string;
  description: string;
  frequency: PayFrequencyType;
  periodStart: CalendarPattern;
  payDay: string;
}

export interface SAPPayrollAreaRow {
  areaCode: string;
  description: string;
  calendarId: string;
}

export interface PayrollAreaConfiguration {
  companyId: string;
  companyName: string;
  profile: CompanyProfile;
  payrollAreas: PayrollArea[];
  sapTables: {
    T549Q: SAPCalendarRow[]; // Payroll calendars
    T549A: SAPPayrollAreaRow[]; // Payroll areas
  };
  status: TaskStatus;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  warnings: string[]; // Validation warnings
}

export interface ValidationResult {
  isValid: boolean;
  employeesCovered: number;
  totalEmployees: number;
  warnings: string[];
  errors: string[];
}
