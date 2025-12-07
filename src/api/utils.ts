// Generic fetch wrapper with base URL and JSON error handling
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
