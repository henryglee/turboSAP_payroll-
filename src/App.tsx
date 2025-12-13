import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import './App.css';
import { DashboardPage } from './pages/DashboardPage';
import { ConfigPage } from './pages/ConfigPage';
import { ChatPage } from './pages/ChatPage';
import { PaymentMethodPage } from './pages/PaymentMethodPage';
import { QuestionsConfigPage } from './pages/QuestionsConfigPage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage, ProtectedRoute } from './components/auth';
import { useAuthStore } from './store/auth';
import { getCurrentUser } from './api/auth';

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const { token, user, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  // Verify token on mount and load user info
  useEffect(() => {
    if (token && !user) {
      getCurrentUser(token)
        .then((userInfo) => {
          setAuth(token, userInfo);
        })
        .catch(() => {
          // Token invalid, clear auth
          clearAuth();
        });
    }
  }, [token, user, setAuth, clearAuth]);

  return (
    <Routes>
      {/* Public route - Login page */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />
        }
      />

      {/* Dashboard route - uses its own DashboardLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Other protected routes - use old MainLayout for now */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function MainLayout() {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();

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
            <button onClick={clearAuth} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation with Links */}
      <nav className="page-nav">
        <Link
          to="/dashboard"
          className={`nav-button ${location.pathname === '/dashboard' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/chat"
          className={`nav-button ${location.pathname === '/chat' ? 'active' : ''}`}
        >
          Payroll Areas
        </Link>
        <Link
          to="/config"
          className={`nav-button ${location.pathname === '/config' ? 'active' : ''}`}
        >
          Manual Configuration
        </Link>
        {user?.role === 'admin' && (
          <>
            <Link
              to="/questions"
              className={`nav-button ${location.pathname === '/questions' ? 'active' : ''}`}
            >
              Questions Configuration
            </Link>
            <Link
              to="/admin"
              className={`nav-button ${location.pathname === '/admin' ? 'active' : ''}`}
            >
              User Management
            </Link>
          </>
        )}
      </nav>

      {/* Nested Routes */}
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/payment-methods" element={<PaymentMethodPage />} />

        {/* Admin-only routes with additional protection */}
        <Route
          path="/questions"
          element={
            <ProtectedRoute requireAdmin>
              <QuestionsConfigPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;
