import { apiFetch } from './utils';

export interface CustomerListResponse {
  customers: string[];
}

export function fetchTerminalCustomers() {
  return apiFetch<CustomerListResponse>('/api/console/reachnett/customers');
}
