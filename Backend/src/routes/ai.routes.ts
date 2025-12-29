import {Router} from 'express';
import { type Request, type Response } from 'express';
import { generateAnalysis } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/analysis', generateAnalysis);

export default router;