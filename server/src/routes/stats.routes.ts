import { Router } from 'express';
import { getStatsHandler } from '../controllers/stats.controller';

const router = Router();

router.get('/stats', getStatsHandler);

export default router;