/**
 * Authentication page component.
 * Shows login form only. Registration is disabled - users must be created by administrators.
 */

import { LoginForm } from './LoginForm';
import { Building2 } from 'lucide-react';

export function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 p-6">
      <div className="w-full max-w-md">
        {/* Logo/Icon Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4 shadow-sm">
            <Building2 className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TurboSAP</h1>
          <p className="text-base text-gray-600 font-medium">Payroll Configuration</p>
          <p className="text-sm text-gray-500 mt-2">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-xl">
          <LoginForm
            onLoginSuccess={() => {
              // Auth state is managed by store, App.tsx will handle redirect
            }}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Secure payroll configuration platform
          </p>
        </div>
      </div>
    </div>
  );
}

