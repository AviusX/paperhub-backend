import { Request, Response } from 'express';
import User from '../../database/models/User';

export const getUser = async (req: Request, res: Response) => {
    const id = req.params.id;
    let user;

    try {
        user = await User.findById(id);
        if (user) {
            return res.status(200).json({
                username: user.username,
                discriminator: user.discriminator,
                postedWallpapers: user.postedWallpapers
            });
        } else {
            return res.status(404).json({ message: "User not found." });
        }
    } catch (err) {
        console.error("Something went wrong while fetching user by id:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }
}