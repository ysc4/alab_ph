// Centralized API configuration and fetch utilities

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001/api";

/**
 * Generic GET request
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * GET request with query parameters
 */
export async function apiGetWithParams<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;
  return apiGet<T>(url);
}

/**
 * POST request
 */
export async function apiPost<T>(endpoint: string, data: Record<string, any>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || errorData.error || 'Failed to complete request');
  }
  return response.json();
}
