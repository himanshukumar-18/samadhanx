/**
 * Canonical re-export of apiClient from src/api/client.
 * Eliminates duplicate axios client instances and maintains single source of truth.
 */
export { apiClient, API_BASE_URL } from '../api/client';
