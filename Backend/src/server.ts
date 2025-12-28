import express from 'express';
import {type Request, type Response} from 'express';

const app = express();
const PORT = 3000;

app.get('/', async (req: Request,res: Response) => {
    res.send("Route working");
})

app.listen(PORT, () => (console.log("Server starting on Port: "+PORT)));