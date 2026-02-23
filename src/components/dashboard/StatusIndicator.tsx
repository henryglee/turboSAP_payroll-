/**
 * StatusIndicator - Reusable status icon component
 */

import { CheckCircle2, Circle } from 'lucide-react';
import type { ModuleStatus } from '../../hooks/useCategoryProgress';

interface StatusIndicatorProps {
  status: ModuleStatus;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizeClass = sizeMap[size];

  if (status === 'completed') {
    return <CheckCircle2 className={`${sizeClass} text-green-600`} />;
  }

  if (status === 'in-progress') {
    return (
      <div className={`${sizeClass} relative`}>
        <Circle className={`${sizeClass} text-amber-500`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
        </div>
      </div>
    );
  }

  // not-started
  return <Circle className={`${sizeClass} text-muted-foreground`} />;
}
