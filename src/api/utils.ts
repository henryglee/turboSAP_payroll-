// Generic fetch wrapper with base URL and JSON error handling
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from store.
 * This is a function to avoid circular dependencies.
 */
function getAuthToken(): string | null {
  try {
    const authData = localStorage.getItem('turbosap-auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get token from localStorage if available
  const token = getAuthToken();

  const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(options?.headers as Record<string, string>),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { detail?: string }).detail ||
        `API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
