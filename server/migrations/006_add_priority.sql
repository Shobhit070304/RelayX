ALTER TABLE jobs ADD COLUMN priority INT NOT NULL DEFAULT 0;
CREATE INDEX idx_jobs_priority ON jobs (priority DESC, available_at ASC);