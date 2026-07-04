import { Request, Response } from 'express';
import { createJob, getJobById } from '../services/jobs.service';
import { getHandler, validatePayload } from '../workers/handlers/index';

const MAX_ATTEMPTS_LIMIT = 25;

export async function createJobHandler(req: Request, res: Response) {
    try {
        const { type, payload, max_attempts, delay_seconds, run_at } = req.body;

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

        // 4. Per-handler payload schema validation — catches missing required fields early
        const normalizedPayload: Record<string, unknown> = (payload && typeof payload === 'object') ? payload : {};
        const payloadError = validatePayload(type, normalizedPayload);
        if (payloadError) {
            return res.status(400).json({ error: payloadError });
        }

        const job = await createJob({ type, payload, max_attempts, delay_seconds, run_at });
        return res.status(201).json(job);
    } catch (err) {
        console.error('Error creating job:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


export async function getJobHandler(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (typeof id !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing job ID' });
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