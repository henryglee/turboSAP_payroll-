/*
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

import React from 'react';
import { useState, useEffect } from 'react';
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

import * as Dialog from '@radix-ui/react-dialog';

import * as Label from '@radix-ui/react-label';

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"


import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { toast } from 'sonner';
import { apiFetch } from '@/api/utils';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';
import type { Transform } from '@dnd-kit/utilities';

import { SortableItem } from './SortableItem.tsx';


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

export interface DeleteModuleResponse {
  success: boolean;
  message: string;
}

interface ReorderModulesResponse {
  success: boolean;
  message?: string;
}

// ============================================
// Icon Mapping
// ============================================

// Form validation schema
const moduleFormSchema = z.object({
  name: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().min(0, 'Order must be a positive number'),
  slug: z.string().optional(), 
});

type ModuleFormData = z.infer<typeof moduleFormSchema>;

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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ModuleFormData>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: undefined,
      order: modules.length > 0 ? Math.max(...modules.map(m => m.order || 0)) + 1 : 1,
    },
  });

  const watchedName = watch('name');
  const watchedIcon = watch('icon');

  // Auto-generate slug from name
  useEffect(() => {
    if (watchedName) {
      const slug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', slug);
    }
  }, [watchedName, setValue]);

  // TODO: Henry - Implement these handlers
  const handleAddModule = async (data: ModuleFormData) => {
    // TODO: Open modal to add new module
    setIsSubmitting(true);
    try {
      console.log('Auth data from localStorage:', localStorage.getItem('turbosap-auth'));
      

      const response = await apiFetch<{ modules: ModuleInfo[] }>('/api/config/modules', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          icon: data.icon,
          order: data.order
        }),
      });

      // If we get here, the request was successful
      if (_onRefresh) _onRefresh();
      setIsAddDialogOpen(false);
      reset();
      toast.success('Module added successfully');
    } catch (error) {
      console.error('Error details:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add module');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleDeleteModule = async (slug: string) => {
    if (!window.confirm(`Are you sure you want to delete the module "${slug}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Call the delete endpoint
      const response = await apiFetch<DeleteModuleResponse>(`/api/config/modules/${slug}`, {
        method: 'DELETE',
      });

      if (response.success) {
        toast.success(`Module "${slug}" deleted successfully`);
        // Refresh the modules list
        if (_onRefresh) _onRefresh();
      }
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete module');
    }
  };

  // Initialize sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // TODO: Henry - Implement drag-and-drop reordering
  // Initialize sensors for drag and drop
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = modules.findIndex(module => module.slug === active.id);
    const newIndex = modules.findIndex(module => module.slug === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    try {
      const reorderedModules = arrayMove(modules, oldIndex, newIndex);

      // Test the endpoint first
      const testResponse = await fetch('http://localhost:8000/api/config/modules/test-reorder-route');
      console.log('Test endpoint response:', await testResponse.json());

      
      console.log('Sending reorder request with:', {
        order: reorderedModules.map((module, index) => ({
          slug: module.slug,
          order: index + 1,
        }))
      });

      const response = await apiFetch<ReorderModulesResponse>(`/api/config/modules/reorder/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: reorderedModules.map((module, index) => ({
            slug: module.slug,
            order: index + 1,
          })),
        }),
      });

      console.log('Reorder response:', response);
      
      if (response.success) {
        toast.success('Module order updated successfully');
        if (_onRefresh) _onRefresh();
      }
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error reordering modules:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update module order');
      if (_onRefresh) _onRefresh();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={modules.map((module) => module.slug)}
        strategy={verticalListSortingStrategy}
      >
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              SAP Modules
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredModules.length}
                {searchQuery ? ` of ${modules.length}` : ""})
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
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Module
              </button>
            </div>
          </div>

          {/* Add Module Dialog */}
          {isAddDialogOpen && (
            <Dialog.Root open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                  <Dialog.Title className="text-lg font-semibold mb-4">
                    Add New Module
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-gray-600 mb-4">
                    Create a new module to organize your system features
                  </Dialog.Description>
                  <form
                    onSubmit={handleSubmit(handleAddModule)}
                    className="space-y-4"
                  >
                    <div>
                      <Label.Root htmlFor="name">Module Name *</Label.Root>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="e.g., Employee Management"
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label.Root htmlFor="description">Description</Label.Root>
                      <Textarea
                        id="description"
                        {...register("description")}
                        placeholder="Brief description of the module"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label.Root htmlFor="icon">Icon</Label.Root>
                      <Select
                        id="icon"
                        value={watchedIcon || ""}
                        onChange={(e) => setValue("icon", e.target.value)}
                        className="w-full"
                      >
                        <option value="" disabled>
                          Select an icon
                        </option>
                        {Object.entries(MODULE_ICONS).map(([key, Icon]) => (
                          <option key={key} value={key}>
                            {key.charAt(0).toUpperCase() +
                              key.slice(1).replace("-", " ")}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Label.Root htmlFor="order">Order</Label.Root>
                      <Input
                        id="order"
                        type="number"
                        min="0"
                        {...register("order", { valueAsNumber: true })}
                        className={errors.order ? "border-red-500" : ""}
                      />
                      {errors.order && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.order.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          reset();
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add Module"
                        )}
                      </Button>
                    </div>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}

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

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              {/* Empty for drag handle */}
            </div>
            <div className="col-span-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </div>
            <div className="col-span-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </div>
            <div className="col-span-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </div>
            <div className="col-span-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </div>
          </div>

          {/* Table */}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  {filteredModules.map((module) => {
                    const Icon = getModuleIcon(module.slug, module.icon);
                    return (
                      <SortableItem key={module.slug} id={module.slug}>
                        {({
                          attributes,
                          listeners,
                          setNodeRef,
                          transform,
                          transition,
                          isDragging,
                        }: {
                          attributes: ReturnType<typeof useSortable>['attributes'];
                          listeners: ReturnType<typeof useSortable>['listeners'];
                          setNodeRef: (node: HTMLElement | null) => void;
                          transform: Transform | null;
                          transition: string | undefined;
                          isDragging: boolean;
                        }) => (
                          <tr
                            ref={setNodeRef}
                            style={{
                              transform: transform
                                ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                                : "none",
                              transition,
                              position: 'relative',
                              zIndex: isDragging ? 1 : "auto",
                              opacity: isDragging ? 0.8 : 1,
                              backgroundColor: isDragging
                                ? "rgba(254, 243, 199, 0.5)"
                                : "white",
                            }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div
                                className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
                                {...attributes}
                                {...listeners}
                              >
                                <GripVertical className="h-4 w-4 text-gray-300" />
                                <Icon className="h-5 w-5 text-gray-400" />
                              </div>
                            </td>
                            <td className="px-6 py-4 w-128">
                              <div className="font-medium text-gray-900 text-sm w-36 max-w-[16rem]">
                                <div className="line-clamp-2">
                                  {module.name}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 w-128">
                              <div className="text-gray-500 text-sm w-64 max-w-[16rem]">  {/* Added max-w and fixed width */}
                                <div className="line-clamp-2">  {/* Limits to 2 lines with ellipsis */}
                                  {module.description || "—"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 w-48">
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
                            <td className="px-6 py-4 w-48">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  to={`/admin/modules/${module.slug}`}
                                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Edit module"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteModule(module.slug);
                                  }}
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete module"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </SortableItem>
                    );
                  })}

                  {filteredModules.length === 0 && modules.length > 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No modules match "{searchQuery}"
                      </td>
                    </tr>
                  )}

                  {modules.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No modules configured yet. Click "Add Module" to get
                        started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
