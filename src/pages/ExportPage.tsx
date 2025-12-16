/**
 * ExportPage - Blank page
 */

import { DashboardLayout } from '../components/layout/DashboardLayout';

export function ExportPage() {
  return (
    <DashboardLayout
      title="JSON Export"
      description="Generate SAP-compatible configuration"
      currentPath="/export"
      hideHeader={true}
    >
      <div></div>
    </DashboardLayout>
  );
}
