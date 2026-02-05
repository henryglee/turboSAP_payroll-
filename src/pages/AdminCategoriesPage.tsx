/**
 * AdminCategoriesPage - Tree-style hierarchy management
 * CRUD for categories and tasks with module linkage visibility
 */

import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import {
  Plus,
  Pencil,
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
// Tree Node Components
// ============================================

function AdminCategoryNode({
  category,
  expanded,
  onToggle,
  onEditCategory,
  onDeleteCategory,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  category: Category;
  expanded: boolean;
  onToggle: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (cat: Category) => void;
  onAddTask: (categoryId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}) {
  const linkedCount = category.tasks.filter(t => t.type != null).length;

  return (
    <div>
      <div className="flex items-center group">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded-md hover:bg-gray-100 transition-colors"
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

        {/* Admin controls - visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onAddTask(category.id); }}
            className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
            title="Add Task"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditCategory(category); }}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit Category"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteCategory(category); }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete Category"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-4 pl-2 border-l border-gray-200">
          {category.tasks.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400 italic">
              No tasks — click + to add one
            </div>
          ) : (
            category.tasks.map((task) => (
              <AdminTaskNode
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
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
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const isLinked = task.type != null;

  return (
    <div className="flex items-center group">
      <div
        className={cn(
          'flex-1 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md',
          isLinked ? 'text-gray-900' : 'text-gray-500'
        )}
      >
        {isLinked ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{task.name}</span>

        {/* Module info badges */}
        {isLinked && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
              {task.type === 'legacy' ? 'guided' : 'config'}
            </span>
            {task.route && (
              <span className="hidden group-hover:flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0">
                <Link2 className="w-3 h-3" />
                {task.route}
              </span>
            )}
          </>
        )}

        <span className="text-[10px] text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.id}
        </span>
      </div>

      {/* Admin controls */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
        <button
          onClick={() => onEdit(task)}
          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Edit Task"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete Task"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
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

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'category' | 'task';
    id: string;
    name: string;
  } | null>(null);

  // Form states
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    try {
      setLoading(true);
      setError(null);
      const data = await getHierarchy();
      setCategories(data.categories);
      // Expand all on initial load
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

  // Auto-expand when searching
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

  // ---- ID Generation Helpers ----
  function getNextCategoryId(): string {
    // Find highest C### number and increment
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
    // Find highest T### number in this category and increment
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

  // ---- Category CRUD ----
  function openAddCategory() {
    setEditingCategory(null);
    setFormId(getNextCategoryId());
    setFormName('');
    setFormOrder(categories.length * 10 + 10);
    setShowCategoryModal(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setFormId(category.id);
    setFormName(category.name);
    setFormOrder(category.displayOrder);
    setShowCategoryModal(true);
  }

  async function handleSaveCategory() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formName.trim(),
          displayOrder: formOrder,
        });
      } else {
        const id = formId.trim() || getNextCategoryId();
        await createCategory({ id, name: formName.trim(), displayOrder: formOrder });
      }
      setShowCategoryModal(false);
      await loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }

  // ---- Task CRUD ----
  function openAddTask(categoryId: string) {
    setEditingTask(null);
    setFormId(getNextTaskId(categoryId));
    setFormName('');
    const category = categories.find(c => c.id === categoryId);
    setFormOrder((category?.tasks.length || 0) * 10 + 10);
    setFormCategoryId(categoryId);
    setShowTaskModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setFormId(task.id);
    setFormName(task.name);
    setFormOrder(task.displayOrder);
    setFormCategoryId(task.categoryId);
    setShowTaskModal(true);
  }

  async function handleSaveTask() {
    if (!formName.trim() || !formCategoryId) return;
    setSaving(true);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          name: formName.trim(),
          displayOrder: formOrder,
          categoryId: formCategoryId,
        });
      } else {
        const id = formId.trim() || getNextTaskId(formCategoryId);
        await createTask({
          id,
          name: formName.trim(),
          categoryId: formCategoryId,
          displayOrder: formOrder,
        });
      }
      setShowTaskModal(false);
      await loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete ----
  function openDeleteCategory(category: Category) {
    setDeleteTarget({ type: 'category', id: category.id, name: category.name });
    setShowDeleteModal(true);
  }

  function openDeleteTask(task: Task) {
    setDeleteTarget({ type: 'task', id: task.id, name: task.name });
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === 'category') {
        await deleteCategory(deleteTarget.id);
      } else {
        await deleteTask(deleteTarget.id);
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await loadHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  // ---- Render ----

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
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      <div className="max-w-4xl">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories & tasks..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
            />
          </div>

          {/* Stats + controls */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-medium text-gray-700">{categories.length}</span> categories
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-medium text-green-600">{linkedTasks}</span>
              {' / '}
              {totalTasks} linked
            </span>
            <span className="text-gray-300">|</span>
            <button onClick={expandAll} className="hover:text-gray-700 transition-colors">
              Expand all
            </button>
            <button onClick={collapseAll} className="hover:text-gray-700 transition-colors">
              Collapse all
            </button>
          </div>

          {/* Add Category */}
          <button
            onClick={openAddCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Category
          </button>
        </div>

        {/* Tree */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          {filteredCategories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {searchQuery ? 'No matching categories or tasks' : 'No categories yet'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredCategories.map((category) => (
                <AdminCategoryNode
                  key={category.id}
                  category={category}
                  expanded={effectiveExpanded.has(category.id)}
                  onToggle={() => handleToggle(category.id)}
                  onEditCategory={openEditCategory}
                  onDeleteCategory={openDeleteCategory}
                  onAddTask={openAddTask}
                  onEditTask={openEditTask}
                  onDeleteTask={openDeleteTask}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-5 text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Linked to module
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="w-3.5 h-3.5 text-gray-300" />
            Not linked
          </div>
          <div className="text-gray-300 ml-auto">
            Hover rows to see controls
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* Category Modal */}
      {/* ============================================ */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {!editingCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID (optional)
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                    placeholder="auto-generated from name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formOrder}
                  onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCategory ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Task Modal */}
      {/* ============================================ */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {!editingTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID (optional)
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                    placeholder="auto-generated from name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Task name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCategoryId}
                  onChange={e => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formOrder}
                  onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTask}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingTask ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Delete Confirmation Modal */}
      {/* ============================================ */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-600">
                Are you sure you want to delete the {deleteTarget.type}{' '}
                <span className="font-medium text-gray-900">
                  "{deleteTarget.name}"
                </span>
                ?
                {deleteTarget.type === 'category' && (
                  <span className="block mt-2 text-sm text-red-600">
                    This will also delete all tasks in this category.
                  </span>
                )}
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
