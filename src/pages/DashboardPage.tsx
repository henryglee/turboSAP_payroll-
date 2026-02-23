/**
 * DashboardPage - Main landing page after login
 *
 * Bento-style layout:
 * - Left (2/3): All category workflows + validation alerts
 * - Right (1/3): Quick Actions, What's Next, Export, Recent Activity
 */

import { useAuthStore } from '../store/auth';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAggregateProgress } from '../hooks/useCategoryProgress';
import {
  CategoryWorkflow,
  ValidationAlerts,
  DashboardSidebar,
  ProgressSummary,
} from '../components/dashboard';

export function DashboardPage() {
  const { user } = useAuthStore();

  // Get progress for all categories
  const aggregateProgress = useAggregateProgress();
  const [enterprise, tax, banking] = aggregateProgress.categories;

  // Find first active module across all categories for shortcuts
  const firstActiveCategory = aggregateProgress.categories.find(
    (c) => c.activeModuleSlug !== null
  );
  const activeModule = firstActiveCategory?.modules.find(
    (m) => m.slug === firstActiveCategory.activeModuleSlug
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.username || ''}`}
      description="Configure your SAP payroll migration settings"
      currentPath="/dashboard"
    >
      <div className="flex gap-8">
        {/* Left column - All workflows in a single card */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Main card with all category workflows */}
          <div className="bg-card border border-border rounded-lg p-6">
            {/* Validation Alerts (across all modules) */}
            <ValidationAlerts progress={enterprise} />

            {/* Enterprise Structure Workflow */}
            <CategoryWorkflow
              progress={enterprise}
              title="Enterprise Structure"
            />

            {/* Tax Configuration Workflow */}
            <div className="mt-6 pt-6 border-t border-border">
              <CategoryWorkflow
                progress={tax}
                title="Tax Configuration"
              />
            </div>

            {/* Banking Workflow */}
            <div className="mt-6 pt-6 border-t border-border">
              <CategoryWorkflow
                progress={banking}
                title="Banking"
              />
            </div>
          </div>

          {/* Progress Summary at bottom */}
          <ProgressSummary
            completedModules={aggregateProgress.completedModules}
            totalModules={aggregateProgress.totalModules}
            percentComplete={aggregateProgress.percentComplete}
          />
        </div>

        {/* Right column - Sidebar */}
        <div className="w-72 flex-shrink-0">
          <DashboardSidebar
            isEnterpriseComplete={enterprise.isComplete}
            completedModules={aggregateProgress.completedModules}
            totalModules={aggregateProgress.totalModules}
            activeModuleSlug={activeModule?.slug ?? null}
            activeModuleName={activeModule?.name ?? null}
            activeModuleRoute={activeModule?.route ?? null}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
