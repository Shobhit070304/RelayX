ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs (priority DESC, available_at ASC);