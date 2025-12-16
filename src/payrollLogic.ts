import type {
  CompanyProfile,
  PayrollArea,
  PayFrequency,
  BusinessUnit,
  Union,
  TimeZone,
  ValidationResult,
  SAPCalendarRow,
  SAPPayrollAreaRow,
} from './types';

/**
 * Calendar ID mapping based on frequency and pattern
 * These map to SAP T549Q payroll calendar IDs
 * Based on partner conventions
 */
const CALENDAR_MAPPINGS: Record<string, string> = {
  'weekly-mon-sun-friday': '80',
  'weekly-sun-sat-friday': '81',
  'weekly-mon-sun-thursday': '82',
  'weekly-sun-sat-thursday': '83',
  'biweekly-mon-sun-thursday': '20',
  'biweekly-mon-sun-friday': '21',
  'biweekly-sun-sat-thursday': '22',
  'biweekly-sun-sat-friday': '23',
  'semimonthly-mon-sun-friday': '30', // Semi-monthly always 1-15, 16-end
  'semimonthly-mon-sun-thursday': '31',
  'monthly-mon-sun-friday': '40',
  'monthly-mon-sun-thursday': '41',
};

/**
 * Generate 2-character payroll area code based on partner conventions
 * Examples from partner doc: WF (Weekly Friday), WT (Weekly Thursday), SW (Southwest)
 *
 * Format: [Frequency Letter][Differentiator Letter/Digit]
 * - W = Weekly, B = Biweekly, S = Semimonthly, M = Monthly
 * - Second char: Pay day (F/T), Business Unit (C/S/O), Time Zone (H/M/P/I), or Union digits
 */
function generateAreaCode(
  freq: PayFrequency,
  bu: BusinessUnit,
  union?: Union,
  tz?: TimeZone
): string {
  // Frequency prefix: W, B, S, M
  let freqPrefix = freq.type[0].toUpperCase();

  // Handle semimonthly to avoid confusion with "Services" in business units
  if (freq.type === 'semimonthly') {
    freqPrefix = 'S'; // Could also use 'M' for semi-Monthly if preferred
  }

  // Determine second character based on what's causing the split
  let secondChar = '';

  // Priority 1: Union (most specific)
  if (union?.uniqueCalendar || union?.uniqueFunding) {
    // Extract first digit from union code (e.g., "L11" -> "1", "L39" -> "3")
    const unionDigits = union.code.replace(/\D/g, '');
    secondChar = unionDigits[0] || 'U';
  }
  // Priority 2: Time zone (if it affects processing)
  else if (tz && tz.affectsProcessing) {
    secondChar = tz.code[0]; // H, M, P, I
  }
  // Priority 3: Business unit (if separate areas required)
  else if (bu.requiresSeparateArea && bu.code !== 'all') {
    secondChar = bu.code[0].toUpperCase(); // C, S, O
  }
  // Priority 4: Pay day (default differentiator)
  else {
    // F = Friday, T = Thursday, C = Current
    if (freq.payDay === 'friday') secondChar = 'F';
    else if (freq.payDay === 'thursday') secondChar = 'T';
    else if (freq.payDay === 'current') secondChar = 'C';
    else secondChar = 'X'; // Custom
  }

  return freqPrefix + secondChar;
}

/**
 * Determine SAP calendar ID based on frequency and pattern
 */
function determineCalendarId(freq: PayFrequency, hasUniqueUnionCalendar?: boolean): string {
  if (hasUniqueUnionCalendar) {
    // Union with unique calendar gets a different calendar ID
    // For now, we'll add 100 to base calendar (this is simplified logic)
    const baseCalendar = determineCalendarId(freq, false);
    return (parseInt(baseCalendar) + 100).toString();
  }

  const key = `${freq.type}-${freq.calendarPattern}-${freq.payDay}`;
  return CALENDAR_MAPPINGS[key] || '99'; // 99 = custom/unknown
}

/**
 * Generate human-readable 20-character description for payroll area
 * Following partner convention (max 20 chars for SAP)
 */
function generateDescription(
  freq: PayFrequency,
  bu: BusinessUnit,
  union?: Union,
  tz?: TimeZone
): string {
  const parts: string[] = [];

  // Frequency abbreviation
  const freqAbbrev: Record<string, string> = {
    weekly: 'Wkly',
    biweekly: 'BiWk',
    semimonthly: 'SemiMo',
    monthly: 'Mo',
  };
  parts.push(freqAbbrev[freq.type]);

  // Pay day abbreviation
  if (!union && !tz && !bu.requiresSeparateArea) {
    const payDayAbbrev: Record<string, string> = {
      friday: 'Fri',
      thursday: 'Thu',
      current: 'Cur',
      custom: 'Cus',
    };
    parts.push(payDayAbbrev[freq.payDay] || 'Pay');
  }

  // Business unit (if separating)
  if (bu.requiresSeparateArea && bu.code !== 'all') {
    // Abbreviate business unit names to fit in 20 chars
    const buAbbrev = bu.name.length > 8 ? bu.name.substring(0, 8) : bu.name;
    parts.push(buAbbrev);
  }

  // Time zone
  if (tz && tz.affectsProcessing) {
    parts.push(tz.code); // Already short: ML, HI, PR, IO
  }

  // Union
  if (union?.uniqueCalendar || union?.uniqueFunding) {
    parts.push(union.code); // L11, L39, etc.
  }

  // Join and truncate to 20 chars
  let description = parts.join(' ');
  if (description.length > 20) {
    description = description.substring(0, 20);
  }

  return description;
}

/**
 * Generate reasoning/audit trail for why this area was created
 */
function generateReasoning(
  freq: PayFrequency,
  bu: BusinessUnit,
  union?: Union,
  tz?: TimeZone
): string[] {
  const reasons: string[] = [];

  reasons.push(`Pay frequency: ${freq.type} (${freq.employeeCount} employees)`);

  if (bu.requiresSeparateArea) {
    reasons.push(`Business unit requires separate area: ${bu.name}`);
  }

  if (union?.uniqueCalendar) {
    reasons.push(`Union ${union.code} requires unique payroll calendar`);
  }

  if (union?.uniqueFunding) {
    reasons.push(`Union ${union.code} requires separate funding tracking`);
  }

  if (tz && tz.affectsProcessing) {
    reasons.push(`Time zone ${tz.name} affects payroll processing timing`);
  }

  return reasons;
}

/**
 * CORE ALGORITHM: Calculate minimal payroll areas based on SAP best practices
 *
 * Splitting criteria (in order of priority):
 * 1. Pay Frequency (ALWAYS separate - different calendars)
 * 2. Business Unit (ONLY if operationally required for funding/control)
 * 3. Unions (ONLY if unique calendar OR unique funding)
 * 4. Time Zone (ONLY if affects processing deadlines)
 * 5. Security (ONLY if mandatory access control needed)
 */
export function calculateMinimalAreas(profile: CompanyProfile): PayrollArea[] {
  const areas: PayrollArea[] = [];

  // Step 1: Split by frequency (ALWAYS separate)
  for (const freq of profile.payFrequencies) {

    // Step 2: Split by business unit (if required)
    const relevantBUs = profile.businessUnits.filter(bu => bu.requiresSeparateArea);

    if (relevantBUs.length === 0) {
      // No BU splitting needed - treat all as one group
      relevantBUs.push({
        code: 'all',
        name: 'All Business Units',
        employeeCount: freq.employeeCount,
        requiresSeparateArea: false,
      });
    }

    for (const bu of relevantBUs) {

      // Step 3: Split by union (if unique calendar or funding)
      const relevantUnions = profile.unions.filter(u =>
        u.uniqueCalendar || u.uniqueFunding
      );

      if (relevantUnions.length > 0) {
        // Create separate area for each union
        for (const union of relevantUnions) {
          const area = createPayrollArea(freq, bu, union);
          areas.push(area);
        }

        // Also create area for non-union employees (if any)
        const unionEmployeeCount = relevantUnions.reduce((sum, u) => sum + u.employeeCount, 0);
        const nonUnionCount = freq.employeeCount - unionEmployeeCount;

        if (nonUnionCount > 0) {
          const area = createPayrollArea(freq, bu);
          area.employeeCount = nonUnionCount;
          areas.push(area);
        }
      } else {
        // Step 4: Split by time zone (if affects processing)
        const relevantTZs = profile.timeZones.filter(tz => tz.affectsProcessing);

        if (relevantTZs.length > 1) {
          // Multiple time zones that affect processing
          for (const tz of relevantTZs) {
            const area = createPayrollArea(freq, bu, undefined, tz);
            area.employeeCount = tz.employeeCount;
            areas.push(area);
          }
        } else {
          // No further splitting needed
          const area = createPayrollArea(freq, bu);
          areas.push(area);
        }
      }
    }
  }

  return areas;
}

/**
 * Helper function to create a single payroll area
 */
function createPayrollArea(
  freq: PayFrequency,
  bu: BusinessUnit,
  union?: Union,
  tz?: TimeZone
): PayrollArea {
  const code = generateAreaCode(freq, bu, union, tz);
  const calendarId = determineCalendarId(freq, union?.uniqueCalendar);
  const description = generateDescription(freq, bu, union, tz);
  const reasoning = generateReasoning(freq, bu, union, tz);

  return {
    code,
    description,
    frequency: freq.type,
    calendarId,
    businessUnit: bu.code,
    timeZone: tz?.code,
    union: union?.code,
    employeeCount: freq.employeeCount, // Will be adjusted by caller if needed
    generatedBy: 'system',
    reasoning,
  };
}

/**
 * Validate the payroll area configuration
 */
export function validateConfiguration(
  profile: CompanyProfile,
  areas: PayrollArea[]
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Calculate total employees covered
  const employeesCovered = areas.reduce((sum, area) => sum + area.employeeCount, 0);

  // Check coverage
  if (employeesCovered < profile.totalEmployees) {
    warnings.push(
      `Only ${employeesCovered} of ${profile.totalEmployees} employees are assigned to payroll areas`
    );
  }

  if (employeesCovered > profile.totalEmployees) {
    errors.push(
      `Employee count mismatch: ${employeesCovered} assigned but only ${profile.totalEmployees} total`
    );
  }

  // Check for unions with unique calendars
  for (const union of profile.unions) {
    if (union.uniqueCalendar) {
      const unionArea = areas.find(a => a.union === union.code);
      if (!unionArea) {
        warnings.push(
          `Union ${union.code} requires unique calendar but no separate payroll area created`
        );
      }
    }
  }

  // Check for duplicate area codes
  const codes = areas.map(a => a.code);
  const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate payroll area codes: ${duplicates.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    employeesCovered,
    totalEmployees: profile.totalEmployees,
    warnings,
    errors,
  };
}

/**
 * Generate SAP table data (T549Q - Payroll Calendars)
 */
export function generateSAPCalendars(areas: PayrollArea[]): SAPCalendarRow[] {
  const calendars = new Map<string, SAPCalendarRow>();

  for (const area of areas) {
    if (!calendars.has(area.calendarId)) {
      // Find a matching area to get details
      const freq = area.frequency;

      calendars.set(area.calendarId, {
        calendarId: area.calendarId,
        description: `${freq.charAt(0).toUpperCase() + freq.slice(1)} Payroll Calendar`,
        frequency: area.frequency,
        periodStart: 'mon-sun', // Simplified - would come from freq data
        payDay: 'friday', // Simplified - would come from freq data
      });
    }
  }

  return Array.from(calendars.values());
}

/**
 * Generate SAP table data (T549A - Payroll Areas)
 */
export function generateSAPAreas(areas: PayrollArea[]): SAPPayrollAreaRow[] {
  return areas.map(area => ({
    areaCode: area.code,
    description: area.description,
    calendarId: area.calendarId,
  }));
}
