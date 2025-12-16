/**
 * AdminCategoriesPage - Placeholder for category management
 * Shows intent for future CRUD functionality without implementation
 */

import { AdminLayout } from '../components/layout/AdminLayout';
import {
  Layers,
  FolderTree,
  Plus,
  Edit,
  ArrowRight,
} from 'lucide-react';

export function AdminCategoriesPage() {
  return (
    <AdminLayout
      title="Category Management"
      description="Organize configuration modules by category"
    >
      {/* Coming Soon Banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Layers className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700">Category Management Coming Soon</p>
            <p className="text-sm text-gray-600 mt-1">
              This feature will allow administrators to define and organize configuration categories,
              map them to SAP transactions, and control which modules are available to end users.
            </p>
          </div>
        </div>
      </div>

      {/* Planned Features */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Planned Functionality</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 rounded-lg bg-blue-50">
              <FolderTree className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Hierarchy Management</p>
              <p className="text-xs text-gray-500">Define Category → Task → Step → Execution structure</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 rounded-lg bg-green-50">
              <Plus className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Add New Categories</p>
              <p className="text-xs text-gray-500">Create custom configuration categories</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 rounded-lg bg-purple-50">
              <Edit className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Edit & Reorder</p>
              <p className="text-xs text-gray-500">Modify category names, descriptions, and order</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 rounded-lg bg-orange-50">
              <ArrowRight className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Module Assignment</p>
              <p className="text-xs text-gray-500">Map configuration modules to categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mockup Preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Interface Preview</h2>
        <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
          {/* Mock Table Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-32 h-4 bg-gray-200 rounded"></div>
              <div className="w-20 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-24 h-8 bg-amber-100 rounded flex items-center justify-center">
              <span className="text-xs text-amber-700">+ Add</span>
            </div>
          </div>

          {/* Mock Table Rows */}
          <div className="space-y-2">
            {['Enterprise Structure', 'Banking', 'Time Management', 'Benefits'].map((name, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">{name}</div>
                    <div className="w-40 h-3 bg-gray-100 rounded mt-1"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Mockup representation of the category management interface
        </p>
      </div>
    </AdminLayout>
  );
}
