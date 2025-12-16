/**
 * ConfigPage - Original checkbox-based configuration interface.
 *
 * This is the existing UI, kept as a fallback option.
 * Layout: ConfigurationPanel on left, PayrollAreasPanel on right
 * Uses DashboardLayout for consistency with other pages.
 */

import { ConfigurationPanel } from '../ConfigurationPanel';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useConfigStore } from '../store';

export function ConfigPage() {
  const { payrollAreas } = useConfigStore();

  return (
    <DashboardLayout
      title="Configuration"
      description="Configure payroll areas using the form-based interface"
      currentPath="/config"
      statusIndicators={{
        payrollAreas: payrollAreas.length > 0 ? 'in-progress' : 'not-started',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: ConfigurationPanel */}
        <div className="bg-card border border-border rounded-lg p-6">
          <ConfigurationPanel />
        </div>

        {/* Right side: Blank */}
        <div></div>
      </div>
    </DashboardLayout>
  );
}
