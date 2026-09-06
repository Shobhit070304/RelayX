import { Request, Response } from 'express';
import { getJobStats } from '../services/stats.service';

export async function getStatsHandler(_req: Request, res: Response) {
    try {
        const stats = await getJobStats();
        return res.status(200).json(stats);
    } catch (err) {
        console.error('Error fetching stats:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}