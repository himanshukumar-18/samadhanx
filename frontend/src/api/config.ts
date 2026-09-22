/**
 * Centralized API and WebSocket URL configuration for SamadhanX.
 *
 * Single Source of Truth for frontend API URL normalization.
 */

/**
 * Resolves the standardized API base URL.
 *
 * Rules:
 * 1. Reads import.meta.env.VITE_API_URL.
 * 2. In production builds:
 *    - If VITE_API_URL is unset, warns and falls back to '/api/v1' (relative proxy).
 *    - NEVER silently falls back to localhost.
 * 3. In development builds:
 *    - Defaults to 'http://localhost:8001/api/v1'.
 * 4. Ensures '/api/v1' is appended exactly once (no duplicate /api/v1/api/v1).
 */
export function getApiBaseUrl(): string {
  const rawUrl = import.meta.env.VITE_API_URL;

  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    if (import.meta.env.PROD) {
      console.warn(
        '[SamadhanX Config Warning]: VITE_API_URL is missing in this production build. ' +
        'Using relative /api/v1.'
      );
      return '/api/v1';
    }
    return 'http://localhost:8001/api/v1';
  }

  const cleanUrl = rawUrl.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api/v1')) {
    return cleanUrl;
  }
  return `${cleanUrl}/api/v1`;
}

/**
 * Resolves the WebSocket endpoint URL for a given path.
 *
 * Automatically converts http -> ws and https -> wss,
 * while ensuring the /api/v1 prefix is preserved.
 *
 * Example:
 * getWebSocketUrl('/chat/ws/123')
 * -> 'wss://samadhanx-api.thetastecatering.com/api/v1/chat/ws/123'
 */
export function getWebSocketUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If base is a relative path (e.g. /api/v1), construct using current window location
  if (base.startsWith('/')) {
    if (typeof window !== 'undefined') {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${loc.host}${base}${cleanPath}`;
    }
    return `ws://localhost:8001${base}${cleanPath}`;
  }

  const wsBase = base.replace(/^http(s?):\/\//i, (_match, isS) => (isS ? 'wss://' : 'ws://'));
  return `${wsBase}${cleanPath}`;
}
