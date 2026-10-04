CREATE INDEX IF NOT EXISTS idx_jobs_pending_claim
  ON jobs (priority DESC, available_at ASC, created_at ASC)
  WHERE status = 'pending';
