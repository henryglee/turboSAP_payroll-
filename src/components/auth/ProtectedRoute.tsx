/**
 * ProtectedRoute - Route wrapper for authenticated pages
 *
 * Checks if user is authenticated and optionally checks for admin role.
 * Redirects to login if not authenticated or to home if insufficient permissions.
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClient?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireClient = false }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but needs admin role → redirect to home
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Authenticated but client-only page and user is admin → redirect to admin
  if (requireClient && user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // All checks passed → render the page
  return <>{children}</>;
}
