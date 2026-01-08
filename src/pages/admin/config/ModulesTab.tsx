/**
 * ModulesTab - Modules management tab for Configuration Management page
 *
 * OWNER: Henry
 *
 * Features to implement:
 * - [x] Module list with search
 * - [ ] Add Module functionality (name, description, icon [maybe], order)
 * - [ ] Drag-and-drop reordering [but do "Add Module" ordering first]
 * - [ ] Save order to modules_metadata.json via API
 * - [ ] Delete module with confirmation (popup window with warning
 *
 * API Endpoints:
 * - GET  /api/config/modules           - List modules (existing)
 * - POST /api/config/modules           - Create module (TODO)
 * - DELETE /api/config/modules/{slug}  - Delete module (TODO)
 * - PUT  /api/config/modules/reorder   - Reorder modules (TODO)
 * 
 *  Primary Files:
 * | File                                   | Purpose                             |
 * |----------------------------------------|-------------------------------------|
 * | src/pages/admin/config/ModulesTab.tsx  | Your main file - all module UI code |
 * | backend/app/routes/module_config.py    | API endpoints (may need new ones)   |
 * | backend/app/data/modules_metadata.json | Module data storage                 |
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Settings,
  Loader2,
  AlertCircle,
  CreditCard,
  Calendar,
  Building2,
  Search,
  X,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface ModuleInfo {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  status?: string;
  order?: number;
  hasConfig: boolean;
  hasBackup: boolean;
  hasOriginal: boolean;
}

export interface ModulesTabProps {
  modules: ModuleInfo[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

// ============================================
// Icon Mapping
// ============================================

const MODULE_ICONS: Record<string, React.ElementType> = {
  'payment-method': CreditCard,
  'credit-card': CreditCard,
  'payroll-area': Calendar,
  'calendar': Calendar,
  'company-code': Building2,
  'building': Building2,
  default: Settings,
};

export function getModuleIcon(slug: string, icon?: string): React.ElementType {
  if (icon && MODULE_ICONS[icon]) {
    return MODULE_ICONS[icon];
  }
  return MODULE_ICONS[slug] || MODULE_ICONS.default;
}

// ============================================
// Component
// ============================================

export function ModulesTab({ modules, loading, error, onRefresh: _onRefresh }: ModulesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter modules based on search
  const filteredModules = modules.filter((module) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      module.name.toLowerCase().includes(query) ||
      module.slug.toLowerCase().includes(query) ||
      (module.description && module.description.toLowerCase().includes(query))
    );
  });

  // TODO: Henry - Implement these handlers
  const handleAddModule = () => {
    // TODO: Open modal to add new module
    console.log('Add module clicked - implement modal');
  };

  const handleDeleteModule = (slug: string) => {
    // TODO: Show confirmation, then call DELETE /api/config/modules/{slug}
    console.log('Delete module:', slug);
  };

  // TODO: Henry - Implement drag-and-drop reordering
  // const handleDragEnd = (result: any) => {
  //   // Use @dnd-kit/core or react-beautiful-dnd
  //   console.log('Drag ended:', result);
  // };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          SAP Modules
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({filteredModules.length}{searchQuery ? ` of ${modules.length}` : ''})
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-2 w-64 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={handleAddModule}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-gray-600">Loading modules...</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  {/* Drag handle column */}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredModules.map((module) => {
                const Icon = getModuleIcon(module.slug, module.icon);
                return (
                  <tr key={module.slug} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                        <Icon className="h-5 w-5 text-gray-400" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{module.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-500 text-sm">
                        {module.description || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {module.hasConfig ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Not Configured
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/modules/${module.slug}`}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit module"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteModule(module.slug)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete module"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredModules.length === 0 && modules.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No modules match "{searchQuery}"
                  </td>
                </tr>
              )}

              {modules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No modules configured yet. Click "Add Module" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
