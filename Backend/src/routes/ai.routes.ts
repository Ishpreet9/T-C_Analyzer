import {Router} from 'express';
import { getAnalysis, rescan } from '../controllers/analysis.controller.js';

const router = Router();

router.post('/analysis', getAnalysis);
router.post('/rescan', rescan);

export default router;