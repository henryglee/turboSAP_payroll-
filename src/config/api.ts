/**
 * API Configuration
 *
 * Centralized configuration for all API endpoints.
 * Uses environment variables to support different deployment environments.
 */

/**
 * Get the API base URL from environment variables.
 * Falls back to localhost for development if not set.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;

  if (envUrl) {
    return envUrl;
  }

  // Fallback for development
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  // In production, throw error if not configured
  throw new Error(
    'VITE_API_URL environment variable is not set. ' +
    'Please create a .env.production file with VITE_API_URL=your-api-url'
  );
};

/**
 * API base URL - use this in all API calls
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * Environment info for debugging
 */
export const ENV_INFO = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiUrl: API_BASE_URL,
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', ENV_INFO);
}
