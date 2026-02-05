import {Router} from 'express';
import { type Request, type Response } from 'express';
import { getAnalysis, rescan } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/analysis', getAnalysis);
router.post('/rescan', rescan);
// router.post('/check-similarity', checkSimilarity);

export default router;