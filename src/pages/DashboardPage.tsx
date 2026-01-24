/**
 * DashboardPage - Main landing page after login
 * FIX: derive module status from useExportData (same as Export Center)
 * UI changes:
 *  - remove count (3/2)
 *  - hide status badge for JSON Export card
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useExportData } from '../hooks/useExportData';
import { Calendar, CreditCard, FileJson, ArrowRight, Bell, Clock } from 'lucide-react';

type ModuleStatus = 'not-started' | 'in-progress' | 'completed';

function mapExportStatus(s: 'complete' | 'incomplete' | 'not-started'): ModuleStatus {
  if (s === 'complete') return 'completed';
  if (s === 'incomplete') return 'in-progress';
  return 'not-started';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ✅ Use the same “source of truth” as Export Center
  const { payrollStatus, paymentStatus } = useExportData();

  const payrollCardStatus = useMemo(
    () => mapExportStatus(payrollStatus.status),
    [payrollStatus.status]
  );

  const paymentCardStatus = useMemo(
    () => mapExportStatus(paymentStatus.status),
    [paymentStatus.status]
  );

  // Progress only counts the two modules, not export
  const totalModules = 2;
  const completedModules =
    (payrollCardStatus === 'completed' ? 1 : 0) + (paymentCardStatus === 'completed' ? 1 : 0);
  const progress = Math.round((completedModules / totalModules) * 100);

  const getStatusBadge = (status: ModuleStatus) => {
    if (status === 'not-started') {
      return (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
          Not Started
        </span>
      );
    }
    if (status === 'in-progress') {
      return (
        <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        Completed
      </span>
    );
  };

  const modules = useMemo(
    () => [
      {
        id: 'payroll-areas',
        title: 'Payroll Areas',
        description: 'Define payroll frequencies and period parameters',
        icon: Calendar,
        route: '/payroll-area',
        status: payrollCardStatus,
        showStatus: true,
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        description: 'Configure ACH, check, and paycard options',
        icon: CreditCard,
        route: '/payment-methods',
        status: paymentCardStatus,
        showStatus: true,
      },
      {
        id: 'export',
        title: 'JSON Export',
        description: 'Generate SAP-compatible configuration',
        icon: FileJson,
        route: '/export',
        action: 'Click to configure',
        // ✅ per your request: no status badge at all
        showStatus: false,
      },
    ],
    [payrollCardStatus, paymentCardStatus]
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.username || ''}`}
      description="Configure your SAP payroll migration settings"
      currentPath="/dashboard"
    >
      {/* Top Row */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Progress:</span>
          <span className="text-sm font-semibold text-foreground">{progress}%</span>
        </div>

        <button className="p-2 hover:bg-secondary rounded-lg transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last activity: Just now</span>
        </div>
      </div>

      {/* Module Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Configuration Modules</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => navigate(module.route)}
                className="group relative bg-card border border-border rounded-lg p-6 hover:shadow-md hover:border-primary/50 transition-all duration-200 text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  {/* ✅ hide badge for JSON Export */}
                  {module.showStatus ? getStatusBadge((module as any).status) : null}
                </div>

                <h3 className="text-base font-semibold text-foreground mb-2">{module.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{module.description}</p>

                {/* ✅ remove counts (3/2). show small helper text instead */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {module.action
                      ? module.action
                      : (module as any).status === 'completed'
                        ? 'Configured'
                        : (module as any).status === 'in-progress'
                          ? 'In progress'
                          : 'Not started'}
                  </span>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity - keep simple */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">Most recent update: Just now</p>
      </div>
    </DashboardLayout>
  );
}
