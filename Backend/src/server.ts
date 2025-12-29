import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {type Request, type Response} from 'express';
import aiRoutes from './routes/ai.routes.js';

const app = express();
const PORT = 3000;

app.use(cors());

app.use(express.json());

app.use('/api/ai', aiRoutes);

app.get('/', async (req: Request,res: Response) => {
    res.send("Route working");
});

app.listen(PORT, () => (console.log("Server starting on Port: "+PORT)));