import IWallpaper from '../../database/interfaces/IWallpaper';
import IUser from '../../database/interfaces/IUser';
import User from '../../database/models/User';
import Wallpaper from '../../database/models/Wallpaper';
import Tag from '../../database/models/Tag';

import { SortBy } from '../../enums/SortBy';
import { SortDirection } from '../../enums/SortDirection';
import { PermissionLevel } from '../../enums/PermissionLevel';
import { wallpaperSchema } from '../../validation/wallpaper';

import { Request, Response } from 'express';
import path from 'path';
import multer, { MulterError, FileFilterCallback } from 'multer';
import { unlink } from 'fs/promises';
import sizeOf from 'image-size';
import { promisify } from 'util';
import sharp from 'sharp';

// Good StackOverflow answer for fileFilter-
// https://stackoverflow.com/a/65378054/10509081

const upload = multer({
    dest: 'public/wallpapers',
    limits: {
        fileSize: 1024 * 1024 * 30 // Allow a max of 30 MB image size.
    },
    fileFilter
}).single('wallpaper');

const promisifiedUpload = promisify(upload);


export const getAllWallpapers = async (req: Request, res: Response) => {
    // Sorting variables
    let sortBy;
    let sortDirection;

    // Set sort by. Default is postedAt / most recent.
    if (req.query.sortBy === SortBy.MostDownloaded) {
        sortBy = "downloadCount";
    } else if (req.query.sortBy === SortBy.MostRecent) {
        sortBy = "postedAt";
    } else {
        sortBy = "postedAt";
    }

    let documentCount;
    try {
        documentCount = await Wallpaper.estimatedDocumentCount();
    } catch (err) {
        console.error("Something went wrong while counting number of wallpapers:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

    // Pagination variables
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 0;
    const pageCount = countPages(documentCount, limit);

    if (limit <= 0 || page < 0) {
        return res.status(400).json({ message: "Page number and limit must be positive numbers." });
    }

    // Set sort direction (asc or desc). Default is asc.
    if (req.query.sortDirection === SortDirection.Ascending) {
        sortDirection = "-";
    } else if (req.query.sortDirection === SortDirection.Descending) {
        sortDirection = "";
    } else {
        sortDirection = "-"
    }

    Wallpaper.find()
        .sort(`${sortDirection}${sortBy}`)
        .limit(limit)
        .skip(page * limit)
        .then(wallpapers => {
            res.status(200).json({ wallpapers, pageCount });
        })
        .catch(err => {
            console.error("There was an error while fetching wallpapers", err);
            res.status(500).json({ message: "There was an error while fetching wallpapers." });
        });
}

export const getThumbnail = async (req: Request, res: Response) => {
    const wallpaperId = req.params.id;

    try {
        const wallpaper = await Wallpaper.findById(wallpaperId);
        if (wallpaper) {
            const wallpaperPath = wallpaper.imagePath;
            const isMobile = wallpaper.height > wallpaper.width;
            let thumbnail;

            // If the wallpaper is vertical, make the thumbnail height more
            // than the height of horizontal thumbnails.
            if (isMobile) {
                thumbnail = await sharp(wallpaperPath)
                    .resize(600, 825, { fit: "contain", background: { r: 24, g: 5, b: 41 } })
                    .toBuffer();
            } else {
                thumbnail = await sharp(wallpaperPath)
                    .resize(600, 350, { fit: "contain", background: { r: 24, g: 5, b: 41 } })
                    .toBuffer();
            }

            return res.status(200).end(thumbnail);
        } else {
            return res.status(404).json({ message: "Wallpaper not found." });
        }
    } catch (err) {
        console.error("Something went wrong while fetching wallpaper for thumbnail:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }
}

export const getWallpaper = async (req: Request, res: Response) => {
    const wallpaperId = req.params.id;

    // These are assigned if wallpaper is found.
    let wallpaperPath: string = "";
    let wallpaperName: string = "";

    try {
        const foundWallpaper = await Wallpaper.findById(wallpaperId)

        if (foundWallpaper) {
            wallpaperPath = foundWallpaper.imagePath;
            wallpaperName = foundWallpaper.title + "." + foundWallpaper.mimeType
                .substring("image/".length); // Get the file extension from mime type.

            await Wallpaper.findOneAndUpdate(
                { _id: wallpaperId }, // Search for this wallpaper.
                { $inc: { downloadCount: 1 } }, // Increment the download count.
                { useFindAndModify: false } // options
            );
        } else {
            return res.status(400).json({ message: "Wallpaper not found." });
        }
    } catch (err) {
        console.error("Something went wrong while fetching the wallpaper.", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

    // Get the path of uploads directory (which is supposed to be in project root)
    // by resolving a path using the path of this file.
    wallpaperPath = path.resolve(__dirname + '../../../../') + '/' + wallpaperPath
    return res.status(200).download(wallpaperPath, wallpaperName);
}

export const searchWallpapers = async (req: Request, res: Response) => {
    const searchQuery = req.query.query as string || "";
    const searchRegex = new RegExp(searchQuery, "i");

    let wallpapers: IWallpaper[];
    let documentCount;
    let pageCount;

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

    // Database operations =====================================

    // The DB query used to find the wallpapers and count documents.
    const dbQuery = {
        // If either the title or any tag in the tags array includes
        // the search string, add it to the response array.
        $or: [{
            title: { $regex: searchRegex }
        }, {
            // The $elemMatch operator matches documents that contain an array field with 
            // at least one element that matches all the specified query criteria.
            tags: { $elemMatch: { $regex: searchRegex } }
        }]
    };

    // Get the wallpapers and the page count.
    try {
        wallpapers = await Wallpaper.find(dbQuery)
            .sort(`${sortDirection}${sortBy}`)
            .limit(limit)
            .skip(page * limit);

        documentCount = await Wallpaper.countDocuments(dbQuery);
        pageCount = countPages(documentCount, limit);
    } catch (err) {
        console.error("Something went wrong while searching for wallpapers:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

    // Return result in response ===============================

    // If no wallpapers were found matching the search query, return 404.
    if (!wallpapers || wallpapers.length === 0) {
        return res.status(404).json({ message: "No wallpapers found." });
    }

    // Return the array of matching wallpapers and pageCount.
    return res.status(200).json({ wallpapers, pageCount });
}

export const uploadWallpaper = async (req: Request, res: Response) => {
    if ((req.user as IUser).permissionLevel < PermissionLevel.Creator) {
        return res.status(403).json({ message: "You do not have the permission to upload a wallpaper." });
    }

    try {
        await promisifiedUpload(req, res);

        const file = req.file as Express.Multer.File;

        if (!file) {
            return res.status(400).json({ message: "The file is missing from the request." });
        }

        const title = req.body.title;
        const dimensions = sizeOf(file.path);
        let tags;

        try {
            tags = JSON.parse(req.body.tags);
        } catch (err) {
            deleteFile(file.path);
            console.error("Something went wrong while parsing tags:\n", err);
            return res.status(400).json({ message: "Tags should contain a valid array." });
        }

        const { error: validationError } = wallpaperSchema.validate({ title, tags });

        if (validationError) {
            await deleteFile(file.path);
            return res.status(400).json({ message: validationError.message });
        }

        // If either one or more tags in the tags array do not exist in the db,
        // return an error.
        const tagsExist = await confirmTagsExist(tags);

        if (!tagsExist) {
            await deleteFile(file.path);
            return res.status(409).json({ message: "Either one or more of the tags provided do not exist." });
        }

        try {
            // Save the wallpaper to the database
            const newWallpaper = await new Wallpaper({
                owner: (req.user as IUser)._id,
                title: title,
                imagePath: file.path,
                mimeType: file.mimetype,
                width: dimensions.width,
                height: dimensions.height,
                tags
            }).save();

            // Add the newly created wallpaper's reference to the owner's 
            // document as well.
            await User.findOneAndUpdate(
                { _id: (req.user as IUser)._id }, // Find the owner
                { $push: { postedWallpapers: newWallpaper._id } }, // Push new wallpaper
                { useFindAndModify: false } // options
            );

            // Add the newly created wallpaper's reference to all the selected tag documents.
            await Tag.updateMany(
                { title: { $in: tags } }, // Find all tags where the title is in the given array
                { $push: { wallpapers: newWallpaper._id } }, // Push the reference of new wallpaper
                { useFindAndModify: false } // options
            )
        } catch (err) {
            // If wallpaper cannot be added to the database for some reason,
            // delete the uploaded file from the filesystem to prevent piling
            // up of useless image files.
            console.error("There was an error while uploading the wallpaper:\n", err);
            await deleteFile(file.path);

            return res.status(500).json({ message: "Something went wrong." });
        }

    } catch (err) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
            // If image size is bigger than the limit, send error response.

            return res.status(413).json({ message: "Image size should not be bigger than 30 MB." });
        } else {
            // If file is not an image, send error response.
            // This err is set by the fileFilter function.

            return res.status(415).json({ message: err.message });
        }
    }

    return res.status(201).json({ message: "Wallpaper uploaded successfully." });
}

export const deleteWallpaper = async (req: Request, res: Response) => {
    const wallpaperId: string = req.params.id;

    // Confirm that the wallpaper is "owned" by the logged in user.
    const isOwner = await confirmOwnership(wallpaperId, (req.user as IUser)._id);

    // If user is neither the owner of the wallpaper, nor an admin, reject delete request.
    if (!isOwner && (req.user as IUser).permissionLevel < PermissionLevel.Admin) {
        return res.status(403).json({ message: "You do not have the permission to delete this wallpaper." });
    }

    try {
        const deletedWallpaper = await Wallpaper.findByIdAndDelete(wallpaperId);

        if (deletedWallpaper) {
            // Delete the file from filesystem
            await deleteFile(deletedWallpaper.imagePath);

            // Delete the file from the owner's document
            await User.updateOne(
                { _id: (req.user as IUser)._id },
                { $pull: { postedWallpapers: deletedWallpaper?._id } }
            )

            // Delete the file from all the tags it was associated with
            await Tag.updateMany(
                { title: { $in: deletedWallpaper.tags } }, // Find all the tags that this wallpaper had
                { $pull: { wallpapers: deletedWallpaper._id } }, // Delete the wallpaper's reference from them
                { useFindAndModify: false } // options
            )
        } else {
            return res.status(404).json({ message: "Wallpaper not found and could not be deleted." });
        }
    } catch (err) {
        console.error("There was an error while deleting the wallpapers:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

    return res.status(200).json({ message: "Wallpaper deleted successfully." });
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

/**
 * Determines which file should be saved and which file should not be saved
 *
 * @param {Request} _req
 * @param {Express.Multer.File} file
 * @param {FileFilterCallback} cb
 */
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    const fileType = /^image\//;
    // If the file was not an image, throw error.
    // else, save the image to filesystem.
    if (!fileType.test(file.mimetype)) {
        cb(new Error("Uploaded file was not an image."));
    } else {
        cb(null, true);
    }
}

/**
 * Takes a wallpaper id and a user id
 * and confirms that the given user owns the given wallpaper.
 *
 * @param {string[]} wallpaperId The array of wallpaper ids
 * @param {string} userId The user id that we wish to confirm as the owner
 */
async function confirmOwnership(wallpaperId: string, userId: string) {
    // If for any id in array, the user id does not match the owner,
    // return false
    await Wallpaper.findById(wallpaperId)
        .then(wallpaper => {
            if (!wallpaper?.owner.equals(userId)) {
                return false
            }
        })
        .catch(err => {
            // If anything goes wrong, return false and log error.
            console.error("Something went wrong in confirmOwnership(wallpaperIds, userId):\n", err);
            return false;
        });

    // If the user owns the wallpaper, return true.
    return true;
}

/**
 * Takes an array of tag titles and confirms that all of those tags
 * exist in the database.
 *
 * @param {ITag[]} tags
 * @return {*}  {boolean}
 */
async function confirmTagsExist(tags: string[]) {
    for (let tag of tags) {
        // If even a single tag doesn't exist in the database, return false.
        if (!await Tag.exists({ title: tag })) {
            return false;
        }
    }
    return true;
}

/**
 * Takes a file path as an argument and delets that file from
 * the filesystem.
 *
 * @param {Express.Multer.File} file
 */
function deleteFile(filePath: string) {
    return unlink(filePath)
        .catch(err => {
            console.error("Something went wrong while deleting the file:\n", err);
        });
}