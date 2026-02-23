/**
 * ValidationAlerts - Collapsible alerts section for dashboard
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import type { CategoryProgress } from '../../hooks/useCategoryProgress';

interface ValidationAlert {
  id: string;
  message: string;
  moduleSlug: string;
  moduleName: string;
  route: string;
}

interface ValidationAlertsProps {
  progress: CategoryProgress;
}

function deriveAlerts(progress: CategoryProgress): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  for (const module of progress.modules) {
    if (module.status === 'not-started') {
      alerts.push({
        id: `${module.slug}-not-started`,
        message: `${module.name} has not been configured yet`,
        moduleSlug: module.slug,
        moduleName: module.name,
        route: module.route,
      });
    } else if (module.status === 'in-progress') {
      alerts.push({
        id: `${module.slug}-incomplete`,
        message: `${module.name} configuration is incomplete`,
        moduleSlug: module.slug,
        moduleName: module.name,
        route: module.route,
      });
    }
  }

  return alerts;
}

export function ValidationAlerts({ progress }: ValidationAlertsProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const alerts = deriveAlerts(progress);

  // Don't render if no alerts
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="flex-1 text-left text-sm font-medium text-amber-800 dark:text-amber-200">
          {alerts.length} configuration{alerts.length === 1 ? '' : 's'} need{alerts.length === 1 ? 's' : ''} attention
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => navigate(alert.route)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors text-left group"
            >
              <div className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="flex-1 text-sm text-foreground">
                {alert.message}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                Fix
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
