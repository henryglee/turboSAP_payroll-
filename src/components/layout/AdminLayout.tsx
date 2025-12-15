/**
 * AdminLayout Component
 * Layout wrapper for admin pages with AdminSidebar + Header
 * Uses gold/amber accent theme to differentiate from client UI
 */

import { type ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({
  children,
  title,
  description,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="pl-64">
        {/* Admin Header */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              {description && (
                <p className="text-sm text-gray-500">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Admin
              </span>
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
