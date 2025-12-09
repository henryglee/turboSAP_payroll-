/**
 * Authentication page component.
 * Shows login or register form based on state.
 */

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import './auth.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>TurboSAP Payroll Configuration</h1>
          <p>Sign in to continue or create a new account</p>
        </div>

        {isLogin ? (
          <LoginForm
            onSwitchToRegister={() => setIsLogin(false)}
            onLoginSuccess={() => {
              // Auth state is managed by store, App.tsx will handle redirect
            }}
          />
        ) : (
          <RegisterForm
            onSwitchToLogin={() => setIsLogin(true)}
            onRegisterSuccess={() => {
              // Auth state is managed by store, App.tsx will handle redirect
            }}
          />
        )}
      </div>
    </div>
  );
}

