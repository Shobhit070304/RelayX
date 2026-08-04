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

export interface PaginatedResponse<T> {
  data?: T[];
  jobs?: T[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface CreateJobResponse {
  data?: Job;
  job?: Job;
  isDuplicate?: boolean;
}

// Determine default API Base URL dynamically
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.port === "3001") {
    return "http://localhost:5000";
  }
  return "http://localhost:5000";
};

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
  async getJobs(params?: { status?: string; limit?: number; offset?: number }): Promise<{ jobs: Job[]; total: number }> {
    const response = await apiClient.get<PaginatedResponse<Job>>("/api/jobs", { params });
    const jobsList = response.data.data || response.data.jobs || [];
    return {
      jobs: jobsList,
      total: response.data.total ?? jobsList.length,
    };
  },

  /**
   * Fetch a single job by UUID
   */
  async getJobById(id: string): Promise<Job> {
    const response = await apiClient.get<{ data?: Job; job?: Job }>(`/api/jobs/${id}`);
    const jobObj = response.data.data || response.data.job;
    if (!jobObj) throw new Error(`Job ${id} not found.`);
    return jobObj;
  },

  /**
   * Enqueue a new background job via POST /api/jobs
   */
  async createJob(input: CreateJobInput): Promise<{ job: Job; isDuplicate: boolean }> {
    const response = await apiClient.post<CreateJobResponse>("/api/jobs", input);
    const createdJob = response.data.data || response.data.job;
    if (!createdJob) throw new Error("Failed to parse returned job response.");
    return {
      job: createdJob,
      isDuplicate: !!response.data.isDuplicate,
    };
  },

  /**
   * Fetch dead letter queue jobs
   */
  async getDeadLetterJobs(params?: { limit?: number; offset?: number }): Promise<{ jobs: Job[]; total: number }> {
    const response = await apiClient.get<PaginatedResponse<Job>>("/api/dead-letter", { params });
    const jobsList = response.data.data || response.data.jobs || [];
    return {
      jobs: jobsList,
      total: response.data.total ?? jobsList.length,
    };
  },

  /**
   * Retry a dead-lettered job (resets attempts to 0 & status to pending)
   */
  async retryDeadLetterJob(id: string): Promise<Job> {
    const response = await apiClient.post<{ data?: Job; job?: Job }>(`/api/dead-letter/${id}/retry`);
    const retriedJob = response.data.data || response.data.job;
    if (!retriedJob) throw new Error("Failed to parse retried job response.");
    return retriedJob;
  },

  /**
   * Permanently discard a dead-lettered job
   */
  async discardDeadLetterJob(id: string): Promise<boolean> {
    const response = await apiClient.delete<{ success?: boolean }>(`/api/dead-letter/${id}`);
    return response.status === 200 || response.status === 204;
  },
};
