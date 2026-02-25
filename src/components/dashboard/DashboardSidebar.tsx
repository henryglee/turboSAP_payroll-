/**
 * DashboardSidebar - Right column with What's Next, Export, Recent Activity, Shortcuts
 * Compact design - not everything needs to be a card
 */

import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Lock,
  FileOutput,
  Clock,
  Play,
  Receipt,
  Banknote,
} from 'lucide-react';

interface DashboardSidebarProps {
  isEnterpriseComplete: boolean;
  completedModules: number;
  totalModules: number;
  activeModuleSlug: string | null;
  activeModuleName: string | null;
  activeModuleRoute: string | null;
}

export function DashboardSidebar({
  isEnterpriseComplete,
  completedModules,
  totalModules,
  activeModuleSlug,
  activeModuleName,
  activeModuleRoute,
}: DashboardSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Shortcuts */}
      {activeModuleSlug && activeModuleRoute && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Quick Actions
          </h3>
          <button
            onClick={() => navigate(activeModuleRoute)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left group"
          >
            <Play className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Continue {activeModuleName}
              </p>
            </div>
            <ArrowRight className="h-3 w-3 text-primary group-hover:translate-x-0.5 transition-transform" />
          </button>
        </section>
      )}

      {/* What's Next */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            What's Next
          </h3>
          {!isEnterpriseComplete && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <ul className="space-y-1">
          <SidebarLink
            icon={Receipt}
            label="Tax Configuration"
            route="/tax-company"
            disabled={!isEnterpriseComplete}
            navigate={navigate}
          />
          <SidebarLink
            icon={Banknote}
            label="Banking"
            route="/payment-methods"
            disabled={!isEnterpriseComplete}
            navigate={navigate}
          />
        </ul>
      </section>

      {/* Export */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Export
        </h3>
        <button
          onClick={() => navigate('/export')}
          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors text-left group"
        >
          <FileOutput className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          <span className="flex-1 text-sm text-foreground">Export Center</span>
          <span className="text-xs text-muted-foreground">
            {completedModules}/{totalModules} ready
          </span>
        </button>
      </section>

      {/* Recent Activity */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Recent Activity
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Clock className="h-4 w-4" />
          <span>No recent activity</span>
        </div>
      </section>
    </div>
  );
}

// Simple sidebar link component
function SidebarLink({
  icon: Icon,
  label,
  route,
  disabled,
  navigate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  route: string;
  disabled: boolean;
  navigate: (path: string) => void;
}) {
  return (
    <li>
      <button
        onClick={() => !disabled && navigate(route)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-secondary group'
        }`}
      >
        <Icon className={`h-4 w-4 ${disabled ? 'text-muted-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
        <span className={`flex-1 text-sm ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}>
          {label}
        </span>
        {!disabled && (
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        )}
      </button>
    </li>
  );
}
