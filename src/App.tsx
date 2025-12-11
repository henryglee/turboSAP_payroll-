import { useState, useEffect } from 'react';
import './App.css';
import { ConfigPage } from './pages/ConfigPage';
import { ChatPage } from './pages/ChatPage';
import { QuestionsConfigPage } from './pages/QuestionsConfigPage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './components/auth';
import { useAuthStore } from './store/auth';
import { getCurrentUser } from './api/auth';

type PageType = 'config' | 'chat' | 'questions' | 'admin';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('chat');
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

  // Show auth page if not authenticated
  if (!isAuthenticated || !token) {
    return <AuthPage />;
  }

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

      {/* Page Switcher */}
      <nav className="page-nav">
        <button
          className={`nav-button ${currentPage === 'chat' ? 'active' : ''}`}
          onClick={() => setCurrentPage('chat')}
        >
          Chat Configuration
        </button>
        <button
          className={`nav-button ${currentPage === 'config' ? 'active' : ''}`}
          onClick={() => setCurrentPage('config')}
        >
          Manual Configuration
        </button>
        {user?.role === 'admin' && (
          <>
            <button
              className={`nav-button ${currentPage === 'questions' ? 'active' : ''}`}
              onClick={() => setCurrentPage('questions')}
            >
              Questions Configuration
            </button>
            <button
              className={`nav-button ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentPage('admin')}
            >
              User Management
            </button>
          </>
        )}
      </nav>

      {/* Render current page */}
      {currentPage === 'chat' && <ChatPage />}
      {currentPage === 'config' && <ConfigPage />}
      {currentPage === 'questions' && user?.role === 'admin' && <QuestionsConfigPage />}
      {currentPage === 'admin' && user?.role === 'admin' && <AdminPage />}
    </div>
  );
}

export default App;


/* ===========================================
 * ORIGINAL APP CODE (preserved as fallback)
 * Uncomment below and comment out above to restore
 * ===========================================

import './App.css';
import { ConfigurationPanel } from './ConfigurationPanel';
import { PayrollAreasPanel } from './PayrollAreasPanel';
import { useConfigStore } from './store';

function App() {
  const { profile } = useConfigStore();

  return (
    <div className="app">
      <header className="header">
        <h1>SAP Payroll Area Configuration</h1>
        <p>
          {profile.companyName} • Migration Configuration Tool
        </p>
      </header>

      <main className="main-container">
        <ConfigurationPanel />
        <PayrollAreasPanel />
      </main>
    </div>
  );
}

export default App;

 * =========================================== */
