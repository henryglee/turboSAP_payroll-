import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, Outlet } from 'react-router-dom';
import './App.css';

import { DashboardPage } from './pages/DashboardPage';
import { ConfigPage } from './pages/ConfigPage';
import { ChatPage } from './pages/ChatPage';
import { PaymentMethodPage } from './pages/PaymentMethodPage';
import { QuestionsConfigPage } from './pages/QuestionsConfigPage';
import { AdminPage } from './pages/AdminPage';
import { AccountPage } from './pages/AccountPage';
import { PayrollAreaPage } from './pages/PayrollAreaPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { DataTerminalPage } from "./pages/DataTerminalPage.tsx";
import { ConfigurationScopePage } from './pages/ConfigurationScopePage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AuthPage, ProtectedRoute } from './components/auth';
import { useAuthStore } from './store/auth';
import { getCurrentUser } from './api/auth';
import { useNavigate } from 'react-router-dom';


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
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Account - uses DashboardLayout with sidebar */}
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      {/* Payroll Area - New UI with DashboardLayout */}
      <Route
        path="/payroll-area"
        element={
          <ProtectedRoute>
            <PayrollAreaPage />
          </ProtectedRoute>
        }
      />

      {/* Configuration Scope - Shows all modules in Genie hierarchy */}
      <Route
        path="/scope"
        element={
          <ProtectedRoute>
            <ConfigurationScopePage />
          </ProtectedRoute>
        }
      />

      {/* Payment Methods - uses DashboardLayout */}
      <Route
        path="/payment-methods"
        element={
          <ProtectedRoute>
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
      <Route
        path="/admin/modules"
        element={
          <ProtectedRoute requireAdmin>
            <QuestionsConfigPage />
          </ProtectedRoute>
        }
      />
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

      {/* All other protected routes use AppLayout (with purple header/nav) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* User routes */}
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/config" element={<ConfigPage />} />

        {/* Admin-only routes (legacy - kept as backup) */}
        <Route
          path="/modules"
          element={
            <ProtectedRoute requireAdmin>
              <QuestionsConfigPage />
            </ProtectedRoute>
          }
        />
        {/* Old admin page - DEPRECATED, kept as backup */}
        <Route
          path="/admin-legacy"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
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
      </Route>
    </Routes>
  );
}

function AppLayout() {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();


  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

    return (
        <div className="app">
            {/* Header with user info and logout */}
            <header className="app-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1>TurboSAP Payroll Configuration</h1>
                        {user?.companyName && <p>{user.companyName}</p>}
                    </div>
                    <div className="header-right">
                        <div className="user-info-container">
                            <span className="user-name">{user?.username || ''}</span>
                            <span className="user-role">{user?.role || ''}</span>
                        </div>
                        <button onClick={handleLogout} className="logout-button">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

      <nav className="page-nav">
        <Link to="/dashboard" className={`nav-button ${location.pathname === '/dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link to="/chat" className={`nav-button ${location.pathname === '/chat' ? 'active' : ''}`}>
          Payroll Areas
        </Link>
        <Link to="/config" className={`nav-button ${location.pathname === '/config' ? 'active' : ''}`}>
          Manual Configuration
        </Link>
        <Link
          to="/payment-methods"
          className={`nav-button ${location.pathname === '/payment-methods' ? 'active' : ''}`}
        >
          Payment Methods
        </Link>

        {user?.role === 'admin' && (
          <>
            <Link to="/modules" className={`nav-button ${location.pathname === '/modules' ? 'active' : ''}`}>
              Modules
            </Link>
            <Link to="/admin" className={`nav-button ${location.pathname === '/admin' ? 'active' : ''}`}>
              User Management
            </Link>
          </>
        )}
      </nav>

            {/* Render the current route's component */}
            <Outlet/>
        </div>
    );
}

export default App;