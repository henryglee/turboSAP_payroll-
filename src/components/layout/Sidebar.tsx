/**
 * Sidebar Component - From Lovable design
 * Navigation sidebar for TurboSAP with status indicators
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  FileJson,
  LogOut,
  CheckCircle2,
  Circle,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', key: 'dashboard' },
  { icon: Calendar, label: 'Payroll Areas', href: '/chat', key: 'payrollAreas' },
  { icon: CreditCard, label: 'Payment Methods', href: '/payment-methods', key: 'paymentMethods' },
  { icon: FileJson, label: 'Export', href: '/export', key: 'export' },
];

interface SidebarProps {
  currentPath?: string;
  statusIndicators?: {
    payrollAreas?: 'complete' | 'in-progress' | 'not-started';
    paymentMethods?: 'complete' | 'in-progress' | 'not-started';
  };
}

export function Sidebar({ currentPath, statusIndicators = {} }: SidebarProps) {
  const location = useLocation();
  const pathname = currentPath || location.pathname;

  const getStatusIcon = (key: string) => {
    if (key === 'dashboard' || key === 'export') return null;

    const statusKey = key as keyof typeof statusIndicators;
    const status = statusIndicators[statusKey];

    if (status === 'complete') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    }
    if (status === 'in-progress') {
      return <Circle className="h-3.5 w-3.5 text-warning fill-warning" />;
    }
    return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 gradient-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-accent">
            <FileJson className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">TurboSAP</h1>
            <p className="text-xs text-sidebar-foreground/60">Payroll Config</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const statusIcon = getStatusIcon(item.key);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {statusIcon}
                <ChevronRight
                  className={cn(
                    'h-4 w-4 opacity-0 transition-all duration-200',
                    isActive && 'opacity-100',
                    'group-hover:opacity-100'
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
              DS
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">Demo User</p>
              <p className="truncate text-xs text-sidebar-foreground/60">Client</p>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-start gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
