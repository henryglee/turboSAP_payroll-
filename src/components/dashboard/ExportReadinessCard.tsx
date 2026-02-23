/**
 * ExportReadinessCard - Compact export link row
 */

import { useNavigate } from 'react-router-dom';
import { FileOutput, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ExportReadinessCardProps {
  completedModules: number;
  totalModules: number;
}

export function ExportReadinessCard({
  completedModules,
  totalModules,
}: ExportReadinessCardProps) {
  const navigate = useNavigate();
  const isReady = completedModules > 0;
  const allComplete = completedModules === totalModules && totalModules > 0;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate('/export')}
        className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200 text-left group"
      >
        <div className="flex-shrink-0 p-2 bg-secondary rounded-lg group-hover:bg-primary/10">
          <FileOutput className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Export Center
            </h3>
            {allComplete && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isReady ? (
              <>
                {completedModules} module{completedModules === 1 ? '' : 's'} ready
                {!allComplete && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}· {totalModules - completedModules} remaining
                  </span>
                )}
              </>
            ) : (
              'Complete at least one module to enable export'
            )}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </button>
    </div>
  );
}
