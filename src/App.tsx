import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigPage } from './pages/ConfigPage';
import { ChatPage } from './pages/ChatPage';
import { QuestionsConfigPage } from './pages/QuestionsConfigPage';
import { PaymentMethodPage } from './pages/PaymentMethodPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to chat (current default) */}
        <Route path="/" element={<Navigate to="/chat" replace />} />

        {/* Existing pages - work exactly as before */}
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/questions" element={<QuestionsConfigPage />} />

        {/* New payment method page */}
        <Route path="/payment-methods" element={<PaymentMethodPage />} />
      </Routes>
    </BrowserRouter>
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
