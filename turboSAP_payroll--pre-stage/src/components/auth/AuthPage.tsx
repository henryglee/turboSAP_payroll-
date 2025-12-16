/**
 * Authentication page component.
 * Shows login form only. Registration is disabled - users must be created by administrators.
 */

import { LoginForm } from './LoginForm';

export function AuthPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              TurboSAP Payroll Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue
            </p>
          </div>

          <LoginForm
            onLoginSuccess={() => {
              // Auth state is managed by store, App.tsx will handle redirect
            }}
          />
        </div>
      </div>
    </div>
  );
}

