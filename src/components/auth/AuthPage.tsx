/**
 * Authentication page component.
 * Shows login form only. Registration is disabled - users must be created by administrators.
 */

import { LoginForm } from './LoginForm';
import './auth.css';

export function AuthPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>TurboSAP Payroll Configuration</h1>
          <p>Sign in to continue</p>
        </div>

        <LoginForm
          onLoginSuccess={() => {
            // Auth state is managed by store, App.tsx will handle redirect
          }}
        />
      </div>
    </div>
  );
}

