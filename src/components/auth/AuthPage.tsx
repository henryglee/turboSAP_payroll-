import { LoginForm } from './LoginForm';
import { FileJson } from 'lucide-react';

export function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 shadow-md">
                <FileJson className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">TurboSAP</h1>
                <p className="text-sm text-gray-500">Payroll Configuration</p>
              </div>
            </div>
          </div>

          <LoginForm
            onLoginSuccess={() => {
            }}
          />
        </div>
      </div>
    </div>
  );
}

