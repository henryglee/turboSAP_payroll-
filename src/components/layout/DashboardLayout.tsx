/**
 * DashboardLayout Component - From Lovable design
 * Combines Sidebar + Header + main content area
 * Used for all pages with sidebar navigation
 */

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  currentPath?: string;
  statusIndicators?: {
    payrollAreas?: 'complete' | 'in-progress' | 'not-started';
    paymentMethods?: 'complete' | 'in-progress' | 'not-started';
  };
}

export function DashboardLayout({
  children,
  title,
  description,
  currentPath,
  statusIndicators,
}: DashboardLayoutProps) {
  return (
    <div className="payment-method-page min-h-screen bg-background">
      <Sidebar currentPath={currentPath} statusIndicators={statusIndicators} />

      <div className="pl-64">
        <Header title={title} description={description} />

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
