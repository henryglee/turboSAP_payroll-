/**
 * CategoryWorkflow - Vertical list workflow with progress bar
 */

import { ModuleCard } from './ModuleCard';
import type { CategoryProgress } from '../../hooks/useCategoryProgress';

interface CategoryWorkflowProps {
  progress: CategoryProgress;
  title?: string;
}

export function CategoryWorkflow({ progress, title }: CategoryWorkflowProps) {
  const displayTitle = title ?? progress.categoryName;

  return (
    <div>
      {/* Header with progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">
            {displayTitle}
          </h2>
          <span className="text-sm text-muted-foreground">
            {progress.completedCount} of {progress.totalCount} complete
          </span>
        </div>

        {/* Thin progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
      </div>

      {/* Vertical module list */}
      <div className="space-y-2">
        {progress.modules.map((module, index) => (
          <ModuleCard
            key={module.slug}
            module={module}
            isActive={module.slug === progress.activeModuleSlug}
            stepNumber={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
