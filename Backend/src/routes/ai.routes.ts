import {Router} from 'express';
import { type Request, type Response } from 'express';
import { checkSimilarity, generateAnalysis } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/analysis', generateAnalysis);
router.post('/check-similarity', checkSimilarity);

export default router;