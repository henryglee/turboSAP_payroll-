/**
 * ProgressSummary - Overall progress and helpful resources
 */

import { Link } from 'react-router-dom';
import { CheckCircle2, Download, BookOpen } from 'lucide-react';

interface ProgressSummaryProps {
  completedModules: number;
  totalModules: number;
  percentComplete: number;
}

export function ProgressSummary({
  completedModules,
  totalModules,
  percentComplete,
}: ProgressSummaryProps) {
  const isAllComplete = completedModules === totalModules && totalModules > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between">
        {/* Progress indicator */}
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className="stroke-muted"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className={isAllComplete ? 'stroke-green-500' : 'stroke-primary'}
                strokeWidth="3"
                strokeDasharray={`${percentComplete} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
              {percentComplete}%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {completedModules} of {totalModules} modules complete
            </p>
            <p className="text-xs text-muted-foreground">
              {isAllComplete
                ? 'All modules configured - ready to export!'
                : `${totalModules - completedModules} remaining`}
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2">
          <Link
            to="/export"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Center
          </Link>
          <Link
            to="/scope"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            All Modules
          </Link>
        </div>
      </div>

      {/* All complete celebration */}
      {isAllComplete && (
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            Configuration complete! Head to the Export Center to generate your files.
          </span>
        </div>
      )}
    </div>
  );
}
