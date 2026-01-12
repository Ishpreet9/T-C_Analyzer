import {Router} from 'express';
import { type Request, type Response } from 'express';
import { getAnalysis } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/analysis', getAnalysis);
// router.post('/check-similarity', checkSimilarity);

export default router;