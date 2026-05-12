import type { Request, Response, NextFunction } from 'express';
import { createSupabaseClient } from './client';


const client = createSupabaseClient(); 
export async function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;

    const data = await client.auth.getUser(token);

    const userId = data.data.user?.id;

    if(userId) {
        req.userId = userId;
        next();
    }else {
        res.status(401).json({error: "Unauthorized"});
    }
}