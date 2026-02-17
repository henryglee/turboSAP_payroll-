import { apiFetch } from './utils';

export interface TaxTypeCode {
  name: string;
  shortName: string;
  paidBy: 'employee' | 'employer' | string;
  description?: string;
}

export interface TaxAuthorityEntry {
  code: string;
  name: string;
  taxTypes: string[];
  hasLocalTaxes?: boolean;
  notes?: string;
  localJurisdictions?: Array<{
    code: string;
    name: string;
    taxTypes: string[];
  }>;
}

export interface TaxReferenceResponse {
  metadata: {
    source: string;
    description: string;
    usage: string;
  };
  taxTypeCodes: Record<string, TaxTypeCode>;
  federal: TaxAuthorityEntry;
  states: Record<string, TaxAuthorityEntry>;
}

export async function getTaxReference(): Promise<TaxReferenceResponse> {
  return apiFetch<TaxReferenceResponse>('/api/tax-reference');
}
