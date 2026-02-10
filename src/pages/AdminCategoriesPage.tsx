/**
 * AdminCategoriesPage - Master-detail hierarchy management
 * Tree on left, edit panel on right (no modals except delete)
 */

import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  FolderOpen,
  Folder,
  CheckCircle2,
  Circle,
  Search,
  Link2,
  X,
  FolderPlus,
  FilePlus,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  getHierarchy,
  createCategory,
  updateCategory,
  deleteCategory,
  createTask,
  updateTask,
  deleteTask,
  type Category,
  type Task,
} from '../api/hierarchy';

// ============================================
// Types for Detail Panel
// ============================================

type PanelMode =
  | { type: 'none' }
  | { type: 'add-category' }
  | { type: 'edit-category'; category: Category }
  | { type: 'add-task'; categoryId: string; categoryName: string }
  | { type: 'edit-task'; task: Task };

// ============================================
// Tree Node Components
// ============================================

function AdminCategoryNode({
  category,
  expanded,
  selected,
  onToggle,
  onSelect,
  onAddTask,
  onSelectTask,
  onDeleteCategory,
  onDeleteTask,
}: {
  category: Category;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onAddTask: () => void;
  onSelectTask: (task: Task) => void;
  onDeleteCategory: () => void;
  onDeleteTask: (task: Task) => void;
}) {
  const linkedCount = category.tasks.filter(t => t.type != null).length;

  return (
    <div>
      <div className={cn(
        'flex items-center group rounded-md',
        selected && 'bg-amber-50 ring-1 ring-amber-200'
      )}>
        <button
          onClick={onToggle}
          className="p-1.5 text-gray-400 hover:text-gray-600"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 py-1.5 pr-2 text-sm text-left"
        >
          {expanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <span className="flex-1 truncate font-medium text-gray-900">
            {category.name}
          </span>
          {linkedCount > 0 && (
            <span className="text-xs text-green-600 font-medium">
              {linkedCount} linked
            </span>
          )}
          <span className="text-xs text-gray-400">
            {category.tasks.length}
          </span>
        </button>

        {/* Hover controls */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onAddTask(); }}
            className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
            title="Add Task"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteCategory(); }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete Category"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-4 pl-2 border-l border-gray-200">
          {category.tasks.length === 0 ? (
            <button
              onClick={onAddTask}
              className="w-full px-3 py-1.5 text-xs text-gray-400 italic text-left hover:text-amber-600 hover:bg-amber-50 rounded"
            >
              + Add first task
            </button>
          ) : (
            category.tasks.map((task) => (
              <AdminTaskNode
                key={task.id}
                task={task}
                onSelect={() => onSelectTask(task)}
                onDelete={() => onDeleteTask(task)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminTaskNode({
  task,
  onSelect,
  onDelete,
}: {
  task: Task;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const isLinked = task.type != null;

  return (
    <div className="flex items-center group">
      <button
        onClick={onSelect}
        className={cn(
          'flex-1 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-left hover:bg-gray-50',
          isLinked ? 'text-gray-900' : 'text-gray-500'
        )}
      >
        {isLinked ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{task.name}</span>

        {isLinked && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {task.type === 'legacy' ? 'guided' : 'config'}
            </span>
            {task.route && (
              <span className="hidden group-hover:flex items-center gap-0.5 text-[10px] text-gray-400">
                <Link2 className="w-3 h-3" />
                {task.route}
              </span>
            )}
          </>
        )}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity mr-1"
        title="Delete Task"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================
// Detail Panel Component
// ============================================

function DetailPanel({
  mode,
  categories,
  onClose,
  onSave,
  saving,
  getNextCategoryId,
  getNextTaskId,
}: {
  mode: PanelMode;
  categories: Category[];
  onClose: () => void;
  onSave: (data: {
    type: 'category' | 'task';
    isNew: boolean;
    id: string;
    name: string;
    displayOrder: number;
    categoryId?: string;
  }) => void;
  saving: boolean;
  getNextCategoryId: () => string;
  getNextTaskId: (categoryId: string) => string;
}) {
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formCategoryId, setFormCategoryId] = useState('');

  // Initialize form when mode changes
  useEffect(() => {
    if (mode.type === 'add-category') {
      setFormId(getNextCategoryId());
      setFormName('');
      setFormOrder(categories.length * 10 + 10);
    } else if (mode.type === 'edit-category') {
      setFormId(mode.category.id);
      setFormName(mode.category.name);
      setFormOrder(mode.category.displayOrder);
    } else if (mode.type === 'add-task') {
      setFormId(getNextTaskId(mode.categoryId));
      setFormName('');
      const cat = categories.find(c => c.id === mode.categoryId);
      setFormOrder((cat?.tasks.length || 0) * 10 + 10);
      setFormCategoryId(mode.categoryId);
    } else if (mode.type === 'edit-task') {
      setFormId(mode.task.id);
      setFormName(mode.task.name);
      setFormOrder(mode.task.displayOrder);
      setFormCategoryId(mode.task.categoryId);
    }
  }, [mode, categories, getNextCategoryId, getNextTaskId]);

  if (mode.type === 'none') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <Folder className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Select a category or task to edit</p>
          <p className="text-xs mt-1">or use + buttons to add new items</p>
        </div>
      </div>
    );
  }

  const isCategory = mode.type === 'add-category' || mode.type === 'edit-category';
  const isNew = mode.type === 'add-category' || mode.type === 'add-task';
  const title = isNew
    ? isCategory ? 'New Category' : 'New Task'
    : isCategory ? 'Edit Category' : 'Edit Task';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    onSave({
      type: isCategory ? 'category' : 'task',
      isNew,
      id: formId.trim(),
      name: formName.trim(),
      displayOrder: formOrder,
      categoryId: isCategory ? undefined : formCategoryId,
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {isCategory ? (
            <FolderPlus className="w-5 h-5 text-amber-500" />
          ) : (
            <FilePlus className="w-5 h-5 text-blue-500" />
          )}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4">
        <div className="space-y-4 flex-1">
          {/* ID field (only for new items) */}
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID
              </label>
              <input
                type="text"
                value={formId}
                onChange={e => setFormId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <p className="mt-1 text-xs text-gray-400">Auto-generated, but you can customize</p>
            </div>
          )}

          {/* Show ID for existing items (read-only) */}
          {!isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID
              </label>
              <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
                {formId}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={isCategory ? 'Category name' : 'Task name'}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Category selector (tasks only) */}
          {!isCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formCategoryId}
                onChange={e => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Display Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={formOrder}
              onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-gray-400">Lower numbers appear first</p>
          </div>

          {/* Module linkage info (edit task only) */}
          {mode.type === 'edit-task' && mode.task.type && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-xs font-medium text-green-800 mb-1">Linked to Module</div>
              <div className="text-sm text-green-700">
                <span className="font-medium">{mode.task.type === 'legacy' ? 'Guided' : 'Config'}</span>
                {mode.task.route && (
                  <span className="ml-2 text-green-600">{mode.task.route}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !formName.trim()}
            className="flex-1 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? 'Create' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Panel state (replaces modals)
  const [panelMode, setPanelMode] = useState<PanelMode>({ type: 'none' });
  const [saving, setSaving] = useState(false);

  // Delete modal (keep this as modal for safety)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'category' | 'task';
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    try {
      setLoading(true);
      setError(null);
      const data = await getHierarchy();
      setCategories(data.categories);
      setExpanded(new Set(data.categories.map(c => c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }

  // Search filtering
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map(cat => {
        const matchingTasks = cat.tasks.filter(
          t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
        );
        const categoryMatches = cat.name.toLowerCase().includes(q);
        if (categoryMatches) return cat;
        if (matchingTasks.length === 0) return null;
        return { ...cat, tasks: matchingTasks };
      })
      .filter((cat): cat is Category => cat !== null);
  }, [categories, searchQuery]);

  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      return new Set(filteredCategories.map(c => c.id));
    }
    return expanded;
  }, [searchQuery, filteredCategories, expanded]);

  const handleToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(categories.map(c => c.id)));
  const collapseAll = () => setExpanded(new Set());

  // Stats
  const totalTasks = categories.reduce((acc, c) => acc + c.tasks.length, 0);
  const linkedTasks = categories.reduce(
    (acc, c) => acc + c.tasks.filter(t => t.type != null).length,
    0
  );

  // ID generation
  function getNextCategoryId(): string {
    let maxNum = 0;
    for (const cat of categories) {
      const match = cat.id.match(/^C(\d+)$/);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    }
    return `C${String(maxNum + 1).padStart(3, '0')}`;
  }

  function getNextTaskId(categoryId: string): string {
    const category = categories.find(c => c.id === categoryId);
    let maxNum = 0;
    if (category) {
      for (const task of category.tasks) {
        const match = task.id.match(/^C\d+-T(\d+)$/);
        if (match) {
          maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
      }
    }
    return `${categoryId}-T${String(maxNum + 1).padStart(3, '0')}`;
  }

  // Save handler
  async function handleSave(data: {
    type: 'category' | 'task';
    isNew: boolean;
    id: string;
    name: string;
    displayOrder: number;
    categoryId?: string;
  }) {
    setSaving(true);
    try {
      if (data.type === 'category') {
        if (data.isNew) {
          await createCategory({ id: data.id, name: data.name, displayOrder: data.displayOrder });
        } else {
          await updateCategory(data.id, { name: data.name, displayOrder: data.displayOrder });
        }
      } else {
        if (data.isNew) {
          await createTask({
            id: data.id,
            name: data.name,
            categoryId: data.categoryId!,
            displayOrder: data.displayOrder,
          });
        } else {
          await updateTask(data.id, {
            name: data.name,
            categoryId: data.categoryId,
            displayOrder: data.displayOrder,
          });
        }
      }
      setPanelMode({ type: 'none' });
      await loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Delete handler
  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === 'category') {
        await deleteCategory(deleteTarget.id);
      } else {
        await deleteTask(deleteTarget.id);
      }
      setDeleteTarget(null);
      setPanelMode({ type: 'none' });
      await loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  // Check if a category is selected
  const selectedCategoryId = panelMode.type === 'edit-category' ? panelMode.category.id : null;

  if (loading) {
    return (
      <AdminLayout title="Category Management" description="Organize configuration modules by category">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Category Management"
      description="Organize configuration modules by category"
    >
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Master-Detail Layout */}
      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Left: Tree */}
        <div className="w-[55%] flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-green-600">{linkedTasks}</span>
              <span>/</span>
              <span>{totalTasks}</span>
            </div>
            <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700">
              Expand
            </button>
            <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700">
              Collapse
            </button>
            <button
              onClick={() => setPanelMode({ type: 'add-category' })}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Category
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-lg p-2">
            {filteredCategories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                {searchQuery ? 'No matches' : 'No categories yet'}
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredCategories.map((category) => (
                  <AdminCategoryNode
                    key={category.id}
                    category={category}
                    expanded={effectiveExpanded.has(category.id)}
                    selected={selectedCategoryId === category.id}
                    onToggle={() => handleToggle(category.id)}
                    onSelect={() => setPanelMode({ type: 'edit-category', category })}
                    onAddTask={() => setPanelMode({
                      type: 'add-task',
                      categoryId: category.id,
                      categoryName: category.name,
                    })}
                    onSelectTask={(task) => setPanelMode({ type: 'edit-task', task })}
                    onDeleteCategory={() => setDeleteTarget({
                      type: 'category',
                      id: category.id,
                      name: category.name,
                    })}
                    onDeleteTask={(task) => setDeleteTarget({
                      type: 'task',
                      id: task.id,
                      name: task.name,
                    })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              Linked
            </div>
            <div className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-gray-300" />
              Not linked
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
          <DetailPanel
            mode={panelMode}
            categories={categories}
            onClose={() => setPanelMode({ type: 'none' })}
            onSave={handleSave}
            saving={saving}
            getNextCategoryId={getNextCategoryId}
            getNextTaskId={getNextTaskId}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Delete {deleteTarget.type}?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete{' '}
                <span className="font-medium text-gray-900">"{deleteTarget.name}"</span>?
                {deleteTarget.type === 'category' && (
                  <span className="block mt-2 text-red-600">
                    This will also delete all tasks in this category.
                  </span>
                )}
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
