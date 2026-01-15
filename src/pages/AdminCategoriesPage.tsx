/**
 * AdminCategoriesPage - Category and Task hierarchy management
 * Simple CRUD interface for managing configuration categories and tasks
 */

import { useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
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

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'task'; id: string; name: string } | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);

  // Form states
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  // Load hierarchy on mount
  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    try {
      setLoading(true);
      setError(null);
      const data = await getHierarchy();
      setCategories(data.categories);
      // Expand all categories by default
      setExpandedCategories(new Set(data.categories.map(c => c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  // Category handlers
  function openAddCategory() {
    setEditingCategory(null);
    setFormId('');
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
        await updateCategory(editingCategory.id, { name: formName.trim(), displayOrder: formOrder });
      } else {
        const id = formId.trim() || formName.toLowerCase().replace(/\s+/g, '-');
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

  // Task handlers
  function openAddTask(categoryId: string) {
    setEditingTask(null);
    setTargetCategoryId(categoryId);
    setFormId('');
    setFormName('');
    const category = categories.find(c => c.id === categoryId);
    setFormOrder((category?.tasks.length || 0) * 10 + 10);
    setFormCategoryId(categoryId);
    setShowTaskModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTargetCategoryId(task.categoryId);
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
        const id = formId.trim() || formName.toLowerCase().replace(/\s+/g, '-');
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

  // Delete handlers
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

  return (
    <AdminLayout
      title="Category Management"
      description="Organize configuration modules by category"
    >
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">Hierarchy</h2>
        </div>
        <button
          onClick={openAddCategory}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      )}

      {/* Categories List */}
      {!loading && categories.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No categories found. Click "Add Category" to create one.
        </div>
      )}

      {!loading && categories.length > 0 && (
        <div className="space-y-3">
          {categories.map(category => (
            <div key={category.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{category.name}</div>
                    <div className="text-xs text-gray-500">
                      {category.tasks.length} task{category.tasks.length !== 1 ? 's' : ''} &middot; Order: {category.displayOrder}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAddTask(category.id)}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Add Task"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEditCategory(category)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Category"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openDeleteCategory(category)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              {expandedCategories.has(category.id) && (
                <div className="divide-y divide-gray-100">
                  {category.tasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400 italic">
                      No tasks in this category
                    </div>
                  ) : (
                    category.tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                        <div className="pl-8">
                          <div className="text-sm font-medium text-gray-700">{task.name}</div>
                          <div className="text-xs text-gray-400">ID: {task.id} &middot; Order: {task.displayOrder}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditTask(task)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Task"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteTask(task)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID (optional)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
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

      {/* Task Modal */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID (optional)</label>
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
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-600">
                Are you sure you want to delete the {deleteTarget.type}{' '}
                <span className="font-medium text-gray-900">"{deleteTarget.name}"</span>?
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
