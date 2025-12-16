/**
 * ConfigPage - Original checkbox-based configuration interface.
 *
 * This is the existing UI, kept as a fallback option.
 * Layout: ConfigurationPanel on left, PayrollAreasPanel on right
 */

import { ConfigurationPanel } from '../ConfigurationPanel';
import { PayrollAreasPanel } from '../PayrollAreasPanel';
import { DashboardLayout } from '../components/layout/DashboardLayout';

export function ConfigPage() {
  return (
    <DashboardLayout
      title="Configuration"
      description="Configure payroll areas using the checkbox interface"
      currentPath="/config"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <ConfigurationPanel />
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <PayrollAreasPanel />
        </div>
      </div>
    </DashboardLayout>
  );
}
