import { useState } from 'react';
import './App.css';
import { ConfigPage } from './pages/ConfigPage';
import { ChatPage } from './pages/ChatPage';
import { QuestionsConfigPage } from './pages/QuestionsConfigPage';


type PageType = 'config' | 'chat' | 'questions';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('chat');

  return (
    <div>
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
        <button
          className={`nav-button ${currentPage === 'questions' ? 'active' : ''}`}
          onClick={() => setCurrentPage('questions')}
        >
          Questions Configuration
        </button>
      </nav>

      {/* Render current page */}
      {currentPage === 'chat' && <ChatPage />}
      {currentPage === 'config' && <ConfigPage />}
      {currentPage === 'questions' && <QuestionsConfigPage />}
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
