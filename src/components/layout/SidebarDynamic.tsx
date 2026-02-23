/**
 * Sidebar Component - Dynamic navigation from hierarchy
 * Shows linked modules grouped by category
 */

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils.ts';
import { useAuthStore } from '../../store/auth';
import { getHierarchy, type Category, type Task } from '../../api/hierarchy';
import {
  LayoutDashboard,
  FileJson,
  Download,
  LogOut,
  User,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  Loader2,
  FolderOpen,
  Folder,
} from 'lucide-react';

// Static nav items (always shown)
const topItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Sparkles, label: 'AI Config', href: '/ai-config', isNew: true },
];

const bottomItems = [
  { icon: Layers, label: 'All Modules', href: '/scope' },
  { icon: Download, label: 'Export Center', href: '/export' },
];

interface SidebarProps {
  currentPath?: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = currentPath || location.pathname;
  const { user, clearAuth } = useAuthStore();

  // Hierarchy state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Load hierarchy on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await getHierarchy();
        // Filter to only categories that have linked tasks
        const withLinked = data.categories
          .map(cat => ({
            ...cat,
            tasks: cat.tasks.filter(t => t.type != null && t.route != null),
          }))
          .filter(cat => cat.tasks.length > 0);
        setCategories(withLinked);
        // Auto-expand categories that contain the current route
        const expanded = new Set<string>();
        for (const cat of withLinked) {
          if (cat.tasks.some(t => t.route === pathname)) {
            expanded.add(cat.id);
          }
        }
        setExpandedCategories(expanded);
      } catch (err) {
        console.error('Failed to load hierarchy for sidebar:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pathname]);

  const handleSignOut = () => {
    clearAuth();
    navigate('/login');
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Top static items */}
          <div className="space-y-1">
            {topItems.map((item) => {
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
                  {item.isNew && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-500 text-white rounded">NEW</span>
                  )}
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

          {/* Dynamic modules section */}
          <div className="mt-6">
            <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Configuration
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-sidebar-foreground/40" />
              </div>
            ) : categories.length === 0 ? (
              <div className="px-3 py-2 text-xs text-sidebar-foreground/40">
                No modules available
              </div>
            ) : (
              <div className="space-y-0.5">
                {categories.map((category) => (
                  <CategorySection
                    key={category.id}
                    category={category}
                    expanded={expandedCategories.has(category.id)}
                    onToggle={() => toggleCategory(category.id)}
                    currentPath={pathname}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom static items */}
          <div className="mt-6 space-y-1">
            <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Tools
            </div>
            {bottomItems.map((item) => {
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

// Category section with collapsible tasks
function CategorySection({
  category,
  expanded,
  onToggle,
  currentPath,
}: {
  category: Category;
  expanded: boolean;
  onToggle: () => void;
  currentPath: string;
}) {
  const hasActiveTask = category.tasks.some(t => t.route === currentPath);

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
          hasActiveTask
            ? 'text-sidebar-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
        ) : (
          <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500/70" />
        )}
        <span className="flex-1 text-left truncate">{category.name}</span>
        <span className="text-xs text-sidebar-foreground/40">{category.tasks.length}</span>
      </button>

      {expanded && (
        <div className="ml-4 pl-3 border-l border-sidebar-border/50">
          {category.tasks.map((task) => (
            <TaskLink key={task.id} task={task} currentPath={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual task link
function TaskLink({ task, currentPath }: { task: Task; currentPath: string }) {
  const isActive = task.route === currentPath;

  return (
    <Link
      to={task.route || '#'}
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      <span className="flex-1 truncate">{task.name}</span>
      {task.type === 'legacy' && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/50">
          guided
        </span>
      )}
    </Link>
  );
}
