import { Request, Response } from 'express';

const isLoggedIn = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) return next();
    else res.status(401).json({ message: "Login to perform this action!" });
}

export default isLoggedIn;