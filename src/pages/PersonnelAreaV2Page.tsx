import { useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { usePersonnelAreaV2Store } from '../stores/usePersonnelAreaV2Store';
import type { WizardScreen } from '../stores/usePersonnelAreaV2Store';
import { WizardShell } from '../components/pa-psa-v2/WizardShell';
import { LivePreviewPanel } from '../components/pa-psa-v2/LivePreviewPanel';
import { OrgTypeSelector } from '../components/pa-psa-v2/phase1/OrgTypeSelector';
import { RegionListEditor } from '../components/pa-psa-v2/phase1/RegionListEditor';
import { DifferenceFactors } from '../components/pa-psa-v2/phase2/DifferenceFactors';
import { RegionSubareaToggle } from '../components/pa-psa-v2/phase2/RegionSubareaToggle';
import { SubareaEditor } from '../components/pa-psa-v2/phase3/SubareaEditor';
import { CompanyCodeAssignment } from '../components/pa-psa-v2/phase3/CompanyCodeAssignment';
import { StructureReview } from '../components/pa-psa-v2/phase4/StructureReview';
import { FilePreview } from '../components/pa-psa-v2/phase4/FilePreview';
import { ExportActions } from '../components/pa-psa-v2/phase4/ExportActions';

// ─────────────────────────────────────────────────────────────────────────────
// Screen Content Renderer
// ─────────────────────────────────────────────────────────────────────────────

function renderScreenContent(screen: WizardScreen) {
  switch (screen) {
    case '1.1':
      return <OrgTypeSelector />;
    case '1.2':
      return <RegionListEditor />;
    case '2.1':
      return <DifferenceFactors />;
    case '2.2':
      return <RegionSubareaToggle />;
    case '3.1':
      return <SubareaEditor />;
    case '3.2':
      return <CompanyCodeAssignment />;
    case '4.1':
      return (
        <div className="space-y-8">
          <StructureReview />
          <FilePreview />
          <ExportActions />
        </div>
      );
    default:
      return <div>Unknown screen</div>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function PersonnelAreaV2Page() {
  const { currentScreen, loadCompanyCodes, orgType } = usePersonnelAreaV2Store();

  // Load company codes on mount
  useEffect(() => {
    loadCompanyCodes();
  }, [loadCompanyCodes]);

  // Show preview panel when we have selected an org type (after 1.1)
  const showPreview = orgType !== null && currentScreen !== '1.1';

  return (
    <DashboardLayout
      title="Personnel Areas & Subareas"
      description="Define your organizational structure for SAP HR configuration"
    >
      <div className="max-w-7xl mx-auto">
        {/* Wizard Progress */}
        <WizardShell />

        {/* Main Content Area */}
        <div className={`mt-8 ${showPreview ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}`}>
          {/* Step Content */}
          <div className={showPreview ? 'lg:col-span-2' : ''}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
              {renderScreenContent(currentScreen)}
            </div>
          </div>

          {/* Live Preview */}
          {showPreview && (
            <div className="lg:col-span-1">
              <LivePreviewPanel />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
