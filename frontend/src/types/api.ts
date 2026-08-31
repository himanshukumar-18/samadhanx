export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded';
  checks: {
    database: string;
    redis: string;
  };
  timestamp: string;
}

export interface PgVectorTestResponse {
  status: string;
  extension: string;
  l2_distance: number;
  cosine_distance: number;
  vector_math: string;
}

export interface CeleryDispatchResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface CeleryStatusResponse {
  task_id: string;
  state: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | string;
  ready: boolean;
  successful: boolean | null;
  result?: {
    task_id: string;
    status: string;
    message: string;
    processed_at: string;
    worker: string;
  } | null;
}
