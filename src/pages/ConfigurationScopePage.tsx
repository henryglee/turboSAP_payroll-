/**
 * ConfigurationScopePage - Tree-style hierarchy navigator
 * Category → Task with navigation based on task.type and task.route
 *
 * Reads from GET /api/hierarchy (backed by hierarchy.json)
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  CheckCircle2,
  ArrowRight,
  Circle,
  Search,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getHierarchy, type Category, type Task } from '../api/hierarchy';

// ============================================
// Tree Node Components
// ============================================

function CategoryNode({
  category,
  expanded,
  onToggle,
}: {
  category: Category;
  expanded: boolean;
  onToggle: () => void;
}) {
  const implementedCount = category.tasks.filter(t => t.type != null).length;
  const hasImplemented = implementedCount > 0;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded-md hover:bg-gray-100 transition-colors group"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        {expanded ? (
          <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
        <span className={cn(
          'flex-1 truncate',
          hasImplemented ? 'text-gray-900 font-medium' : 'text-gray-500'
        )}>
          {category.name}
        </span>
        {hasImplemented && (
          <span className="text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            {implementedCount}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {category.tasks.length}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 pl-2 border-l border-gray-200">
          {category.tasks.map((task) => (
            <TaskNode key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskNode({ task }: { task: Task }) {
  const navigate = useNavigate();
  const isAvailable = task.type != null && task.route != null;

  return (
    <button
      onClick={() => {
        if (isAvailable && task.route) {
          navigate(task.route);
        }
      }}
      disabled={!isAvailable}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded-md transition-colors',
        isAvailable
          ? 'hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'
          : 'opacity-50 cursor-default'
      )}
    >
      {isAvailable ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      )}
      <span className={cn('flex-1 truncate', !isAvailable && 'text-gray-400')}>
        {task.name}
      </span>
      {isAvailable && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
          {task.type === 'legacy' ? 'guided' : 'config'}
        </span>
      )}
      {isAvailable && (
        <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      )}
    </button>
  );
}

// ============================================
// Main Component
// ============================================

export function ConfigurationScopePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-expand categories that have implemented tasks
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchHierarchy() {
      try {
        const response = await getHierarchy();
        setCategories(response.categories);
        // Auto-expand categories with available tasks
        const autoExpand = new Set<string>();
        for (const cat of response.categories) {
          if (cat.tasks.some(t => t.type != null)) {
            autoExpand.add(cat.id);
          }
        }
        setExpanded(autoExpand);
      } catch (err) {
        console.error('Failed to load hierarchy:', err);
        setError('Failed to load configuration hierarchy.');
      } finally {
        setLoading(false);
      }
    }
    fetchHierarchy();
  }, []);

  // Filter categories/tasks by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map(cat => {
        const matchingTasks = cat.tasks.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
        const categoryMatches = cat.name.toLowerCase().includes(q);
        if (categoryMatches) return cat; // Show all tasks if category matches
        if (matchingTasks.length === 0) return null;
        return { ...cat, tasks: matchingTasks };
      })
      .filter((cat): cat is Category => cat !== null);
  }, [categories, searchQuery]);

  // When searching, expand all matching categories
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      return new Set(filteredCategories.map(c => c.id));
    }
    return expanded;
  }, [searchQuery, filteredCategories, expanded]);

  const handleToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(categories.map(c => c.id)));
  const collapseAll = () => setExpanded(new Set());

  const availableCount = categories.reduce(
    (acc, cat) => acc + cat.tasks.filter(t => t.type != null).length,
    0
  );
  const totalCount = categories.reduce(
    (acc, cat) => acc + cat.tasks.length,
    0
  );

  if (loading) {
    return (
      <DashboardLayout title="Configuration Scope" currentPath="/scope">
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading hierarchy...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Configuration Scope" currentPath="/scope">
        <div className="flex items-center justify-center py-20">
          <p className="text-red-500">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Configuration Scope"
      description="SAP payroll configuration modules organized by category"
      currentPath="/scope"
    >
      <div className="max-w-4xl">
        {/* Header bar */}
        <div className="flex items-center gap-4 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>

          {/* Summary + controls */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-medium text-green-600">{availableCount}</span>
              {' / '}
              <span>{totalCount}</span>
              {' available'}
            </span>
            <span className="text-gray-300">|</span>
            <button onClick={expandAll} className="hover:text-gray-700 transition-colors">
              Expand all
            </button>
            <button onClick={collapseAll} className="hover:text-gray-700 transition-colors">
              Collapse all
            </button>
          </div>
        </div>

        {/* Tree */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          {filteredCategories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No matching categories or tasks
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredCategories.map((category) => (
                <CategoryNode
                  key={category.id}
                  category={category}
                  expanded={effectiveExpanded.has(category.id)}
                  onToggle={() => handleToggle(category.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-5 text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Available — click to configure
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="w-3.5 h-3.5 text-gray-300" />
            Coming soon
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
