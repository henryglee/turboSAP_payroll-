/**
 * ConfigPage - Original checkbox-based configuration interface.
 *
 * This is the existing UI, kept as a fallback option.
 * Layout: ConfigurationPanel on left, PayrollAreasPanel on right
 */

import { ConfigurationPanel } from '../ConfigurationPanel';
import { PayrollAreasPanel } from '../PayrollAreasPanel';
import { useConfigStore } from '../store';

export function ConfigPage() {
  const { profile } = useConfigStore();

  return (
    <div className="app">
      <header className="header">
        <h1>SAP Payroll Area Configuration</h1>
        <p>{profile.companyName} - Manual Configuration Tool</p>
      </header>

      <main className="main-container">
        <ConfigurationPanel />
        <PayrollAreasPanel />
      </main>
    </div>
  );
}
