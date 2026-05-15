import type { Request, Response, NextFunction } from 'express';
import { createSupabaseClient } from './client';
import { prisma } from './db';


const client = createSupabaseClient(); 
export async function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;

    const data = await client.auth.getUser(token);

    const userId = data.data.user?.id;

    if(userId) {
        try {
            console.log({
                    id: data.data.user!.id,
                    superbaseId: data.data.user!.id,
                    email: data.data.user?.email!,
                    provider: data.data.user?.app_metadata.provider === "google" ? "Google" : "Github",
                    name: data.data.user?.user_metadata.name!
        })
            await prisma.user.create({
                data: {
                    id: data.data.user!.id,
                    superbaseId: data.data.user!.id,
                    email: data.data.user?.email!,
                    provider: data.data.user?.app_metadata.provider === "google" ? "Google" : "Github",
                    name: data.data.user?.user_metadata.name!
                }
            })
        }catch(e) {
            // console.error("Error creating user:", e);
        }
        req.userId = userId;
        next();
    }else {
        res.status(401).json({error: "Unauthorized"});
    }
}