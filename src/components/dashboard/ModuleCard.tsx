/**
 * ModuleCard - Horizontal row layout for vertical list
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CalendarClock, MapPin, Users, ReceiptCent, CreditCard } from 'lucide-react';
import { StatusIndicator } from './StatusIndicator';
import type { ModuleProgress } from '../../hooks/useCategoryProgress';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'building-2': Building2,
  'calendar-clock': CalendarClock,
  'map-pin': MapPin,
  users: Users,
  'receipt-cent': ReceiptCent,
  'credit-card': CreditCard,
};

interface ModuleCardProps {
  module: ModuleProgress;
  isActive: boolean;
  stepNumber: number;
}

export function ModuleCard({ module, isActive, stepNumber }: ModuleCardProps) {
  const navigate = useNavigate();
  const Icon = iconMap[module.icon] ?? Building2;

  const getStatusText = () => {
    if (module.status === 'completed') {
      return module.itemCount > 0 ? `${module.itemCount} configured` : 'Completed';
    }
    if (module.status === 'in-progress') {
      return 'In progress';
    }
    return 'Not started';
  };

  const getActionText = () => {
    if (module.status === 'completed') return 'View';
    if (module.status === 'in-progress') return 'Continue';
    return 'Start';
  };

  return (
    <button
      onClick={() => navigate(module.route)}
      className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all duration-200 text-left group ${
        isActive
          ? 'bg-primary/10'
          : 'hover:bg-secondary/70'
      }`}
    >
      {/* Step number */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
          module.status === 'completed'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {module.status === 'completed' ? '✓' : stepNumber}
      </div>

      {/* Icon */}
      <div className="flex-shrink-0 p-2 rounded-md bg-secondary/50">
        <Icon
          className={`h-4 w-4 ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {module.name}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {module.description}
        </p>
      </div>

      {/* Right side: status + action */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {getStatusText()}
        </span>
        <StatusIndicator status={module.status} size="sm" />
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
          }`}
        >
          {getActionText()}
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}
