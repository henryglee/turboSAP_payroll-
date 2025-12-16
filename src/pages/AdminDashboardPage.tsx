/**
 * AdminDashboardPage - Admin landing page with bento grid layout
 * Shows overview stats, quick actions, and recent activity
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { useAuthStore } from '../store/auth';
import { apiFetch } from '../api/utils';
import {
  Users,
  Layers,
  FileJson,
  ArrowRight,
  UserPlus,
  Settings,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalModules: number;
  recentExports: number;
}

interface RecentActivity {
  id: number;
  type: 'user_created' | 'config_completed' | 'export_generated' | 'question_updated';
  title: string;
  description: string;
  timestamp: string;
}

// Mock recent activity data (replace with API call when available)
const mockRecentActivity: RecentActivity[] = [
  {
    id: 1,
    type: 'user_created',
    title: 'New User Registered',
    description: 'acme_corp joined the platform',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    type: 'config_completed',
    title: 'Configuration Completed',
    description: 'TechStart Inc finished Payroll Area setup',
    timestamp: '5 hours ago',
  },
  {
    id: 3,
    type: 'export_generated',
    title: 'Export Generated',
    description: 'GlobalCorp downloaded T549A configuration',
    timestamp: '1 day ago',
  },
  {
    id: 4,
    type: 'question_updated',
    title: 'Question Updated',
    description: 'Pay frequency help text modified',
    timestamp: '2 days ago',
  },
];

const getActivityIcon = (type: RecentActivity['type']) => {
  switch (type) {
    case 'user_created':
      return { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50' };
    case 'config_completed':
      return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' };
    case 'export_generated':
      return { icon: FileJson, color: 'text-amber-600', bg: 'bg-amber-50' };
    case 'question_updated':
      return { icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50' };
    default:
      return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' };
  }
};

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalModules: 2, // Payroll Area + Payment Method
    recentExports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user stats
    const loadStats = async () => {
      try {
        const data = await apiFetch<{ users: any[] }>('/api/admin/users');
        if (data && data.users) {
          setStats(prev => ({
            ...prev,
            totalUsers: data.users.length,
            activeUsers: data.users.filter(u => u.role === 'client').length,
          }));
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      subtitle: `${stats.activeUsers} active clients`,
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Modules',
      value: stats.totalModules,
      subtitle: 'Configuration modules',
      icon: Layers,
      href: '/admin/questions',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Recent Exports',
      value: stats.recentExports,
      subtitle: 'This week',
      icon: FileJson,
      href: '/admin/users',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  const quickActions = [
    {
      title: 'Add New User',
      description: 'Create a new client account',
      icon: UserPlus,
      href: '/admin/users',
      action: 'add',
    },
    {
      title: 'Edit Questions',
      description: 'Modify configuration questions',
      icon: HelpCircle,
      href: '/admin/questions',
    },
    {
      title: 'System Settings',
      description: 'Configure platform settings',
      icon: Settings,
      href: '/admin/settings',
    },
  ];

  return (
    <AdminLayout
      title={`Welcome back, ${user?.username || 'Admin'}`}
      description="Manage users and configure the platform"
    >
      {/* Stats Grid - Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.title}
              onClick={() => navigate(stat.href)}
              className="group relative bg-white border border-gray-200 rounded-xl p-6 hover:border-amber-400 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-sm font-medium text-gray-900">{stat.title}</p>
                <p className="text-xs text-gray-500">{stat.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.href)}
                    className="w-full group flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="p-2 rounded-lg bg-amber-50">
                      <Icon className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{action.title}</p>
                      <p className="text-xs text-gray-500 truncate">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <button className="text-sm text-amber-600 hover:text-amber-700 transition-colors">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {mockRecentActivity.map((activity) => {
                const { icon: Icon, color, bg } = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2.5 rounded-lg ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>{activity.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="mt-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">System Status</h2>
          <p className="text-sm text-gray-500">
            Status monitoring will be available as integrations are connected.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
