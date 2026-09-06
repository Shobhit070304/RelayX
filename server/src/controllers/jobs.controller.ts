import { Request, Response } from 'express';
import { createJob, getJobById, listJobs } from '../services/jobs.service';
import { getHandler, validatePayload } from '../workers/handlers/index';

const MAX_ATTEMPTS_LIMIT = 25;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createJobHandler(req: Request, res: Response) {
    try {
        const { type, payload, max_attempts, delay_seconds, run_at, idempotency_key, priority } = req.body;

        // 1. type must be a non-empty string
        if (!type || typeof type !== 'string') {
            return res.status(400).json({ error: '"type" is required and must be a string' });
        }

        // 2. Reject unregistered job types at submission time — prevents poison-pill jobs
        //    from entering the queue and landing in DLQ with attempts: 0
        if (!getHandler(type)) {
            return res.status(400).json({ error: `Job type "${type}" is not registered. No handler found.` });
        }

        // 3. max_attempts must be a positive integer within the allowed range
        if (max_attempts !== undefined) {
            if (typeof max_attempts !== 'number' || !Number.isInteger(max_attempts) || max_attempts < 1) {
                return res.status(400).json({ error: 'max_attempts must be a positive integer greater than or equal to 1' });
            }
            if (max_attempts > MAX_ATTEMPTS_LIMIT) {
                return res.status(400).json({ error: `max_attempts cannot exceed ${MAX_ATTEMPTS_LIMIT}` });
            }
        }

        if (delay_seconds !== undefined && run_at !== undefined) {
            return res.status(400).json({ error: 'Provide either delay_seconds or run_at, not both' });
        }

        if (delay_seconds !== undefined && (typeof delay_seconds !== 'number' || delay_seconds < 0)) {
            return res.status(400).json({ error: 'delay_seconds must be a non-negative number' });
        }

        if (run_at !== undefined) {
            const parsed = new Date(run_at);
            if (isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'run_at must be a valid date string in the future' });
            }
        }

        // 4. priority must be a non-negative integer
        if (priority !== undefined) {
            if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < 0) {
                return res.status(400).json({ error: 'priority must be a non-negative integer (>= 0)' });
            }
        }

        // 4. Per-handler payload schema validation — catches missing required fields early
        const normalizedPayload: Record<string, unknown> = (payload && typeof payload === 'object') ? payload : {};
        const payloadError = validatePayload(type, normalizedPayload);
        if (payloadError) {
            return res.status(400).json({ error: payloadError });
        }

        // 5. idempotency_key — optional, must be a non-empty string if provided
        if (idempotency_key !== undefined && (typeof idempotency_key !== 'string' || idempotency_key.trim() === '')) {
            return res.status(400).json({ error: 'idempotency_key must be a non-empty string' });
        }

        const { job, isDuplicate } = await createJob({ type, payload, max_attempts, delay_seconds, run_at, idempotency_key, priority });

        if (isDuplicate) {
            // Same key seen before — return the original job, not a new one.
            // Idempotent-Replay header lets clients detect this programmatically.
            res.setHeader('Idempotent-Replay', 'true');
            return res.status(200).json(job);
        }

        return res.status(201).json(job);
    } catch (err) {
        console.error('Error creating job:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

const VALID_JOB_STATUSES = ['pending', 'processing', 'completed', 'dead_letter'] as const;

export async function listJobsHandler(req: Request, res: Response) {
    try {
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const status = typeof req.query.status === 'string' && req.query.status.trim() !== '' ? req.query.status.trim() : undefined;

        if (status && !VALID_JOB_STATUSES.includes(status as typeof VALID_JOB_STATUSES[number])) {
            return res.status(400).json({
                error: `Invalid status "${status}". Must be one of: ${VALID_JOB_STATUSES.join(', ')}`,
            });
        }

        if (limit < 1 || limit > 100) {
            return res.status(400).json({ error: '"limit" must be between 1 and 100' });
        }

        if (offset < 0 || isNaN(offset)) {
            return res.status(400).json({ error: '"offset" must be a non-negative integer' });
        }

        const { jobs, total } = await listJobs({ status, limit, offset });

        return res.status(200).json({
            data: jobs,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + jobs.length < total,
            },
        });
    } catch (err) {
        console.error('Error listing jobs:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getJobHandler(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
            return res.status(400).json({ error: 'Invalid or missing job ID format. Expected a valid UUID.' });
        }
        const job = await getJobById(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        return res.status(200).json(job);
    } catch (err) {
        console.error('Error fetching job:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}