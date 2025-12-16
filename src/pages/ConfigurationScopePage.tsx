/**
 * ConfigurationScopePage - Shows the Genie-style hierarchy
 * Category → Task → Step → Execution
 *
 * Visual roadmap of available and upcoming configuration modules
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Landmark,
  Calendar,
  Clock,
  Heart,
  FileCode,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface Step {
  id: string;
  name: string;
  status: 'available' | 'coming-soon';
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'coming-soon';
  route?: string;
  steps?: Step[];
}

interface Category {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tasks: Task[];
}

const configurationCategories: Category[] = [
  {
    id: 'enterprise-structure',
    name: 'Enterprise Structure',
    icon: Building2,
    description: 'Organizational units, company codes, and personnel areas',
    tasks: [
      {
        id: 'payroll-area',
        name: 'Payroll Area Configuration',
        description: 'Define payroll frequencies, periods, and control parameters',
        status: 'available',
        route: '/payroll-area',
        steps: [
          { id: 'pa-1', name: 'Configure Payroll Area', status: 'available' },
          { id: 'pa-2', name: 'Define Pay Period Parameters', status: 'available' },
          { id: 'pa-3', name: 'Create Control Record', status: 'available' },
        ],
      },
      {
        id: 'personnel-area',
        name: 'Personnel Area Setup',
        description: 'Define personnel areas and subareas',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'banking',
    name: 'Banking',
    icon: Landmark,
    description: 'Payment methods, bank connections, and disbursement configuration',
    tasks: [
      {
        id: 'payment-method',
        name: 'Payment Method Configuration',
        description: 'Configure ACH, check, and paycard payment options',
        status: 'available',
        route: '/payment-methods',
        steps: [
          { id: 'pm-1', name: 'Configure Payment Medium Format', status: 'available' },
          { id: 'pm-2', name: 'Define Bank Connection', status: 'available' },
          { id: 'pm-3', name: 'Set Payment Run Parameters', status: 'available' },
        ],
      },
      {
        id: 'direct-deposit',
        name: 'Direct Deposit Setup',
        description: 'Employee banking information and split deposits',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'time-management',
    name: 'Time Management',
    icon: Clock,
    description: 'Work schedules, attendance, and time evaluation',
    tasks: [
      {
        id: 'work-schedule',
        name: 'Work Schedule Rules',
        description: 'Define work schedules and holiday calendars',
        status: 'coming-soon',
      },
      {
        id: 'time-evaluation',
        name: 'Time Evaluation',
        description: 'Configure time types and evaluation rules',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'benefits',
    name: 'Benefits Administration',
    icon: Heart,
    description: 'Health plans, retirement, and other benefit programs',
    tasks: [
      {
        id: 'health-plans',
        name: 'Health Plan Configuration',
        description: 'Medical, dental, and vision plan setup',
        status: 'coming-soon',
      },
      {
        id: 'retirement',
        name: 'Retirement Plans',
        description: '401(k) and pension configuration',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'payroll-schema',
    name: 'Payroll Schema',
    icon: FileCode,
    description: 'Calculation rules, wage types, and processing logic',
    tasks: [
      {
        id: 'wage-types',
        name: 'Wage Type Configuration',
        description: 'Define earnings and deduction wage types',
        status: 'coming-soon',
      },
      {
        id: 'calculation-rules',
        name: 'Calculation Rules',
        description: 'Payroll calculation schema customization',
        status: 'coming-soon',
      },
    ],
  },
];

function CategoryItem({ category }: { category: Category }) {
  const [isExpanded, setIsExpanded] = useState(
    category.tasks.some(t => t.status === 'available')
  );
  const navigate = useNavigate();
  const Icon = category.icon;
  const hasAvailableTasks = category.tasks.some(t => t.status === 'available');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={`p-2 rounded-lg ${hasAvailableTasks ? 'bg-primary/10' : 'bg-gray-100'}`}>
          <Icon className={`h-5 w-5 ${hasAvailableTasks ? 'text-primary' : 'text-gray-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium ${hasAvailableTasks ? 'text-gray-900' : 'text-gray-500'}`}>
            {category.name}
          </h3>
          <p className="text-sm text-gray-500 truncate">{category.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAvailableTasks && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              {category.tasks.filter(t => t.status === 'available').length} Available
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Tasks */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {category.tasks.map((task) => (
            <div key={task.id} className="border-b border-gray-100 last:border-b-0">
              {/* Task Row */}
              <div
                className={`flex items-center gap-3 px-4 py-3 pl-12 ${
                  task.status === 'available'
                    ? 'hover:bg-gray-100 cursor-pointer'
                    : 'opacity-60'
                }`}
                onClick={() => task.route && navigate(task.route)}
              >
                {task.status === 'available' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    task.status === 'available' ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {task.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{task.description}</p>
                </div>
                {task.status === 'available' ? (
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                ) : (
                  <span className="text-xs text-gray-400">Coming Soon</span>
                )}
              </div>

              {/* Steps (only show for available tasks when expanded) */}
              {task.status === 'available' && task.steps && (
                <div className="bg-gray-100/50 py-2">
                  {task.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-2 px-4 py-1.5 pl-20 text-xs text-gray-600"
                    >
                      <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium">
                        {idx + 1}
                      </span>
                      {step.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfigurationScopePage() {
  const availableCount = configurationCategories.reduce(
    (acc, cat) => acc + cat.tasks.filter(t => t.status === 'available').length,
    0
  );
  const totalCount = configurationCategories.reduce(
    (acc, cat) => acc + cat.tasks.length,
    0
  );

  return (
    <DashboardLayout
      title="Configuration Scope"
      description="SAP payroll configuration modules organized by category"
      currentPath="/scope"
    >
      {/* Summary */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Configuration Progress</p>
            <p className="text-lg font-semibold text-gray-900">
              {availableCount} of {totalCount} modules available
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tree */}
      <div className="space-y-3">
        {configurationCategories.map((category) => (
          <CategoryItem key={category.id} category={category} />
        ))}
      </div>

      {/* Footer Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Additional configuration modules will be released in phases.
          Available modules can be accessed directly from the sidebar or by clicking above.
        </p>
      </div>
    </DashboardLayout>
  );
}
