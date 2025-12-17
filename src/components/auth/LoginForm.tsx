/**
 * Login form component.
 */

import { useState } from 'react';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/auth';
import './auth.css';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login({ username, password });
      setAuth(response.token, {
        userId: response.userId,
        username: response.username,
        role: response.role,
        companyName: response.companyName,
        logoPath: response.logoPath,
      });
      onLoginSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Login to TurboSAP</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <p className="text-sm text-gray-500 text-center mt-4">
          Forgot password? Please contact your administrator.
        </p>
      </form>
    </div>
  );
}

