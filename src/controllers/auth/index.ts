import { Request, Response } from 'express';
import IUser from '../../database/interfaces/IUser';

export const logout = (req: Request, res: Response) => {
    if (req.user) {
        req.logout();
        res.json({ message: "Logout successful" });
    } else {
        res.status(400).json({ message: "You need to be logged in to logout." });
    }
};

export const checkAuthenticated = (req: Request, res: Response) => {
    // If user is authenticated, send the user data,
    // else, tell the client that the user is not authenticated
    // and that there is no data to send. Also clear session cookie.
    if (req.user) {
        res.status(200).json({
            discordId: (req.user as IUser).discordId,
            username: (req.user as IUser).username,
            discriminator: (req.user as IUser).discriminator
        });
    }
    else {
        res.clearCookie("session");
        res.sendStatus(204);
    }
};