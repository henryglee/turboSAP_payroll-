import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { DashboardPage } from './pages/DashboardPage';
import { PaymentMethodPage } from './pages/PaymentMethodPage';
// QuestionsConfigPage - commented out, route disabled (see TODO below)
// import { QuestionsConfigPage } from './pages/QuestionsConfigPage';
import { AccountPage } from './pages/AccountPage';
import { PayrollAreaPage } from './pages/PayrollAreaPage';
import { AIConfigPage } from './pages/AIConfigPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { DataTerminalPage } from "./pages/DataTerminalPage.tsx";
import { ConfigurationScopePage } from './pages/ConfigurationScopePage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { ExportCenterPage } from './pages/ExportCenterPage';
import { CodebaseVizPage } from './pages/CodebaseVizPage';
import { PaymentMethodConfigPage } from './pages/admin/PaymentMethodConfigPage';
import { PayrollAreaConfigPage } from './pages/admin/PayrollAreaConfigPage';
import { ConfigurationManagementPage } from './pages/admin/ConfigurationManagementPage';
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { AuthPage, ProtectedRoute } from './components/auth';
import { useAuthStore } from './store/auth';
import { getCurrentUser } from './api/auth';


function App() {
    return (
        <BrowserRouter>
            <AppContent/>
        </BrowserRouter>
    );
}

function AppContent() {
  const { token, user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      getCurrentUser(token)
        .then((userInfo) => setAuth(token, userInfo))
        .catch(() => clearAuth());
    }
  }, [token, user, setAuth, clearAuth]);

  return (
    <Routes>
      {/* Public route - Login page */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />
          ) : (
            <AuthPage />
          )
        }
      />

      {/* Dashboard - uses its own DashboardLayout, no purple header */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireClient>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Account - uses DashboardLayout with sidebar */}
      <Route
        path="/account"
        element={
          <ProtectedRoute requireClient>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      {/* Payroll Area - New UI with DashboardLayout */}
      <Route
        path="/payroll-area"
        element={
          <ProtectedRoute requireClient>
            <PayrollAreaPage />
          </ProtectedRoute>
        }
      />

      {/* AI Config - Hybrid AI-powered configuration */}
      <Route
        path="/ai-config"
        element={
          <ProtectedRoute requireClient>
            <AIConfigPage />
          </ProtectedRoute>
        }
      />

      {/* Configuration Scope - Shows all modules in Genie hierarchy */}
      <Route
        path="/scope"
        element={
          <ProtectedRoute requireClient>
            <ConfigurationScopePage />
          </ProtectedRoute>
        }
      />

      {/* Export Center - Unified export for all SAP config files */}
      <Route
        path="/export"
        element={
          <ProtectedRoute requireClient>
            <ExportCenterPage />
          </ProtectedRoute>
        }
      />

      {/* Codebase Visualization - Architecture map */}
      <Route
        path="/viz"
        element={
          <ProtectedRoute requireClient>
            <CodebaseVizPage />
          </ProtectedRoute>
        }
      />

      {/* Payment Methods - uses DashboardLayout */}
      <Route
        path="/payment-methods"
        element={
          <ProtectedRoute requireClient>
            <PaymentMethodPage key={user?.username ?? 'anon'} />
          </ProtectedRoute>
        }
      />

      {/* New Admin Routes - Uses AdminLayout with gold/amber accent */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requireAdmin>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute requireAdmin>
            <AdminCategoriesPage />
          </ProtectedRoute>
        }
      />
      {/* TODO: Re-enable when /admin/modules page is fixed */}
      {/* <Route
        path="/admin/modules"
        element={
          <ProtectedRoute requireAdmin>
            <QuestionsConfigPage />
          </ProtectedRoute>
        }
      /> */}
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requireAdmin>
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/console"
        element={
          <ProtectedRoute requireAdmin>
            <DataTerminalPage />
          </ProtectedRoute>
        }
      />

      {/* Configuration Management (central hub) */}
      <Route
        path="/admin/config"
        element={
          <ProtectedRoute requireAdmin>
            <ConfigurationManagementPage />
          </ProtectedRoute>
        }
      />

      {/* Documents - Upload/manage training docs for knowledge base */}
      <Route
        path="/admin/documents"
        element={
          <ProtectedRoute requireAdmin>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />

      {/* Module Configuration Pages (detail views) */}
      <Route
        path="/admin/modules/payment-method"
        element={
          <ProtectedRoute requireAdmin>
            <PaymentMethodConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/modules/payroll-area"
        element={
          <ProtectedRoute requireAdmin>
            <PayrollAreaConfigPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect old /admin to new admin dashboard */}
      <Route
        path="/admin"
        element={<Navigate to="/admin/dashboard" replace />}
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 404 catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;