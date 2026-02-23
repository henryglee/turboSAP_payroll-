/**
 * Sidebar Component - From Lovable design
 * Navigation sidebar for TurboSAP with status indicators
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils.ts';
import { useAuthStore } from '../../store/auth';
import { useExportData } from '../../hooks/useExportData';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  FileJson,
  Download,
  LogOut,
  User,
  CheckCircle2,
  Circle,
  ChevronRight,
  Building2,
  Users,
  MapPin,
  ReceiptCent,
  Layers,
  Sparkles,
  Package,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', key: 'dashboard' },
  { icon: Building2, label: 'Company Code', href: '/company-code', key: 'companyCodes' },
  { icon: Calendar, label: 'Payroll Area', href: '/payroll-area', key: 'payrollAreas' },
  { icon: Users, label: 'Employee Group', href: '/employee-group', key: 'employeeGroups' },
  { icon: MapPin, label: 'Personnel Area', href: '/personnel-area-v2', key: 'personnelAreas' },
  { icon: ReceiptCent, label: 'Tax Company', href: '/tax-company', key: 'taxCompanies' },
  { icon: ReceiptCent, label: 'Tax IDs', href: '/tax-id', key: 'taxIds' },
  { icon: ReceiptCent, label: 'SUI Tax Rate', href: '/sui-tax-rate', key: 'suiTaxRate' },
  { icon: CreditCard, label: 'Payment Methods', href: '/payment-methods', key: 'paymentMethods' },
  { icon: Layers, label: 'All Modules', href: '/scope', key: 'scope' },
  { icon: Download, label: 'Export Center', href: '/export', key: 'export' },
];

const adminItems = [
  { icon: Sparkles, label: 'AI Config', href: '/ai-config', key: 'aiConfig' },
  { icon: Package, label: 'Config Modules', href: '/modules', key: 'modules' },
];

interface SidebarProps {
  currentPath?: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = currentPath || location.pathname;
  const { user, clearAuth } = useAuthStore();

  // Get live status from localStorage via useExportData hook
  const { payrollStatus, paymentStatus, companyCodeStatus, taxCompanyStatus } = useExportData();

  const handleSignOut = () => {
    clearAuth();
    navigate('/login');
  };

  const getStatusIcon = (key: string) => {
    // No status icons for nav-only items
    if (key === 'dashboard' || key === 'export') return null;

    // Map key to actual status from useExportData
    let status: 'complete' | 'not-started' = 'not-started';
    if (key === 'payrollAreas') {
      status = payrollStatus.status;
    } else if (key === 'paymentMethods') {
      status = paymentStatus.status;
    } else if (key === 'companyCodes') {
      status = companyCodeStatus.status;
    } else if (key === 'taxCompanies') {
      status = taxCompanyStatus.status;
    }
    // employeeGroups and personnelAreas don't have status in useExportData yet

    if (status === 'complete') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
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
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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

          {/* Admin Section */}
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
              Admin
            </p>
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

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
          </div>
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
              {user?.username?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.username || 'User'}</p>
              <p className="truncate text-xs text-sidebar-foreground/60 capitalize">{user?.role || 'Client'}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Link
              to="/account"
              className={cn(
                "w-full flex items-center justify-start gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                pathname === '/account'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <User className="h-4 w-4" />
              Account
            </Link>
            <button
                   onClick={handleSignOut}
                   className="w-full flex items-center justify-start gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
