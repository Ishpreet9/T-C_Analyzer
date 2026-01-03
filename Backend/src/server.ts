import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {type Request, type Response} from 'express';
import aiRoutes from './routes/ai.routes.js';
import connectDB from './config/config.mongodb.js';
import { start } from 'node:repl';

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/ai', aiRoutes);

const startServer = async () => {
    try {
        
        await connectDB();
        app.listen(PORT, ()=>(console.log("Server starting on Port: "+PORT)));

    } catch (error) {
        console.error("Failed to start server: ", error);
    }
}
startServer();