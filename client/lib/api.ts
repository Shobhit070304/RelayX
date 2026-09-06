import axios, { AxiosError, AxiosInstance } from "axios";

// --- Data Types matching RelayX Backend Models ---
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "dead_letter";

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  priority: number;
  available_at: string;
  last_error?: string | null;
  started_at?: string | null;
  dead_lettered_at?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobInput {
  type: string;
  payload?: Record<string, unknown>;
  max_attempts?: number;
  priority?: number;
  delay_seconds?: number | null;
  run_at?: string | null;
  idempotency_key?: string | null;
}

export interface StatsData {
  counts: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead_letter: number;
  };
  throughput: {
    completed_last_hour: number;
    completed_last_24h: number;
    failed_last_hour: number;
    failed_last_24h: number;
  };
  performance: {
    avg_processing_time_seconds: number | null;
    success_rate_percent: number | null;
  };
  dead_letter: {
    count: number;
    oldest_dead_lettered_at: string | null;
  };
}

export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

// Determine default API Base URL dynamically
const getBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Create Axios Client Instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response Error Interceptor for unified message formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    let errorMessage = "An unexpected network or server error occurred.";
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return Promise.reject(new Error(errorMessage));
  }
);

// --- Strongly Typed API Service Methods ---
export const relayApi = {
  /**
   * Fetch system-wide metrics, throughput, and dead-letter count
   */
  async getStats(): Promise<StatsData> {
    const response = await apiClient.get<StatsData>("/api/stats");
    return response.data;
  },

  /**
   * Fetch list of jobs with optional status filter & pagination
   */
  async getJobs(params?: { status?: string; limit?: number; offset?: number }): Promise<{ jobs: Job[]; total: number; has_more: boolean; limit: number; offset: number }> {
    const response = await apiClient.get<PaginatedResponse<Job>>("/api/jobs", { params });
    const { data, pagination } = response.data;
    return {
      jobs: data,
      total: pagination.total,
      has_more: pagination.has_more,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  },

  /**
   * Fetch a single job by UUID
   */
  async getJobById(id: string): Promise<Job> {
    const response = await apiClient.get<Job>(`/api/jobs/${id}`);
    return response.data;
  },

  /**
   * Enqueue a new background job via POST /api/jobs
   */
  async createJob(input: CreateJobInput): Promise<{ job: Job; isDuplicate: boolean }> {
    const response = await apiClient.post<Job>("/api/jobs", input);
    return {
      job: response.data,
      isDuplicate: response.headers["idempotent-replay"] === "true" || response.status === 200,
    };
  },

  /**
   * Fetch dead letter queue jobs
   */
  async getDeadLetterJobs(params?: { limit?: number; offset?: number }): Promise<{ jobs: Job[]; total: number; has_more: boolean; limit: number; offset: number }> {
    const response = await apiClient.get<PaginatedResponse<Job>>("/api/dead-letter", { params });
    const { data, pagination } = response.data;
    return {
      jobs: data,
      total: pagination.total,
      has_more: pagination.has_more,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  },

  /**
   * Retry a dead-lettered job (resets attempts to 0 & status to pending)
   */
  async retryDeadLetterJob(id: string): Promise<Job> {
    const response = await apiClient.post<Job>(`/api/dead-letter/${id}/retry`);
    return response.data;
  },

  /**
   * Permanently discard a dead-lettered job
   */
  async discardDeadLetterJob(id: string): Promise<boolean> {
    const response = await apiClient.delete<{ success?: boolean }>(`/api/dead-letter/${id}`);
    return response.status === 200 || response.status === 204;
  },
};
