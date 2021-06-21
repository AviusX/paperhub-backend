import { Request, Response } from 'express';
import User from '../../database/models/User';
import Wallpaper from '../../database/models/Wallpaper';
import { SortBy } from '../../enums/SortBy';
import { SortDirection } from '../../enums/SortDirection';

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

export const getUserWallpapers = async (req: Request, res: Response) => {
    const id = req.params.id;

    // Sorting variables
    let sortBy;
    let sortDirection;

    // Pagination variables
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 0;

    // Sorting =================================================

    // Set sort by. Default is postedAt / most recent.
    if (req.query.sortBy === SortBy.MostDownloaded) {
        sortBy = "downloadCount";
    } else if (req.query.sortBy === SortBy.MostRecent) {
        sortBy = "postedAt";
    } else {
        sortBy = "postedAt";
    }

    // Set sort direction (asc or desc). Default is asc.
    if (req.query.sortDirection === SortDirection.Ascending) {
        sortDirection = "-";
    } else if (req.query.sortDirection === SortDirection.Descending) {
        sortDirection = "";
    } else {
        sortDirection = "-"
    }

    // Pagination ==============================================
    if (limit <= 0 || page < 0) {
        return res.status(400).json({ message: "Page number and limit must be positive numbers." });
    }

    // DB Operations ===========================================
    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const documentCount = await Wallpaper.countDocuments({ _id: { $in: user.postedWallpapers } });
        const pageCount = countPages(documentCount, limit);
        const userWallpapers = await Wallpaper.find({ _id: { $in: user.postedWallpapers } })
            .sort(`${sortDirection}${sortBy}`)
            .limit(limit)
            .skip(page * limit);

        return res.status(200).json({ wallpapers: userWallpapers, pageCount });
    } catch (err) {
        console.error("Something went wrong while fetching the user or wallpapers:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }
}

// Custom functions ===========================================

/**
 * Takes the total number of documents and the number of documents
 * to show per page (limit) and returns the number of pages.
 *
 * @param {number} documentCount
 * @param {number} limit
 * @return {*} 
 */
function countPages(documentCount: number, limit: number) {
    return (Math.ceil(documentCount / limit))
}