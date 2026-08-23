import { Router } from 'express';
import { createJobHandler, getJobHandler, listJobsHandler } from '../controllers/jobs.controller';

const router = Router();

router.post('/jobs', createJobHandler);
router.get('/jobs', listJobsHandler);
router.get('/jobs/:id', getJobHandler);

export default router;