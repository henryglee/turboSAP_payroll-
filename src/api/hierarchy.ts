/**
 * Hierarchy API - Categories and Tasks management
 */

import { apiFetch } from './utils';

// Types
export interface Task {
  id: string;
  name: string;
  categoryId: string;
  displayOrder: number;
}

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  tasks: Task[];
}

export interface HierarchyResponse {
  categories: Category[];
}

// GET /api/hierarchy - Get full hierarchy tree
export async function getHierarchy(): Promise<HierarchyResponse> {
  return apiFetch<HierarchyResponse>('/api/hierarchy');
}

// POST /api/hierarchy/categories - Create category
export async function createCategory(data: {
  id: string;
  name: string;
  displayOrder?: number;
}): Promise<{ status: string; category: Category }> {
  return apiFetch('/api/hierarchy/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// PUT /api/hierarchy/categories/{id} - Update category
export async function updateCategory(
  categoryId: string,
  data: { name?: string; displayOrder?: number }
): Promise<{ status: string; category: Category }> {
  return apiFetch(`/api/hierarchy/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// DELETE /api/hierarchy/categories/{id} - Delete category
export async function deleteCategory(
  categoryId: string
): Promise<{ status: string; message: string }> {
  return apiFetch(`/api/hierarchy/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

// POST /api/hierarchy/tasks - Create task
export async function createTask(data: {
  id: string;
  name: string;
  categoryId: string;
  displayOrder?: number;
}): Promise<{ status: string; task: Task }> {
  return apiFetch('/api/hierarchy/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// PUT /api/hierarchy/tasks/{id} - Update task
export async function updateTask(
  taskId: string,
  data: { name?: string; categoryId?: string; displayOrder?: number }
): Promise<{ status: string; task: Task }> {
  return apiFetch(`/api/hierarchy/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// DELETE /api/hierarchy/tasks/{id} - Delete task
export async function deleteTask(
  taskId: string
): Promise<{ status: string; message: string }> {
  return apiFetch(`/api/hierarchy/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// PUT /api/hierarchy/reorder - Bulk reorder
export async function reorderHierarchy(data: {
  categories?: { id: string; displayOrder: number }[];
  tasks?: { id: string; displayOrder: number; categoryId?: string }[];
}): Promise<{ status: string; message?: string; errors?: string[] }> {
  return apiFetch('/api/hierarchy/reorder', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
