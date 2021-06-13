import User from '../../database/models/User';
import Wallpaper from '../../database/models/Wallpaper';
import Tag from '../../database/models/Tag';
import IUser from '../../database/interfaces/IUser';
import { Request, Response } from 'express';
import path from 'path';
import multer, { MulterError, FileFilterCallback } from 'multer';
import { unlink } from 'fs/promises';
import sizeOf from 'image-size';

// Good StackOverflow answer for fileFilter-
// https://stackoverflow.com/a/65378054/10509081

const upload = multer({
    dest: 'public/wallpapers',
    limits: {
        fileSize: 1024 * 1024 * 30 // Allow a max of 30 MB image size.
    },
    fileFilter
}).single('wallpaper');

export const getAllWallpapers = async (req: Request, res: Response) => {
    await Wallpaper.find()
        .then(wallpapers => {
            res.status(200).json(wallpapers);
        })
        .catch(err => {
            console.error("There was an error while fetching wallpapers", err);
            res.status(500).json({ message: "There was an error while fetching wallpapers." });
        });
}

export const getWallpaper = async (req: Request, res: Response) => {
    const wallpaperId = req.params.id;

    // These are assigned if wallpaper is found.
    let wallpaperPath: string = "";
    let wallpaperName: string = "";

    // Assigned if anything goes wrong with db operations.
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    const foundWallpaper = await Wallpaper.findById(wallpaperId)

    if (foundWallpaper) {
        wallpaperPath = foundWallpaper.imagePath;
        wallpaperName = foundWallpaper.title + "." + foundWallpaper.mimeType
            .substring("image/".length); // Get the file extension from mime type.

        await Wallpaper.findOneAndUpdate(
            { _id: wallpaperId }, // Search for this wallpaper.
            { $inc: { downloadCount: 1 } }, // Increment the download count.
            { useFindAndModify: false } // options
        ).catch(err => {
            console.error("Something went wrong while fetching the wallpaper.", err);
            errStatusCode = 500;
            errMessage = "Something went wrong.";
        })
    } else {
        errStatusCode = 400;
        errMessage = "Wallpaper not found.";
    }

    // If anything goes wrong, send the assigned error message & status code.
    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    // Get the path of uploads directory (which is supposed to be in project root)
    // by resolving a path using the path of this file.
    wallpaperPath = path.resolve(__dirname + '../../../../') + '/' + wallpaperPath
    return res.status(200).download(wallpaperPath, wallpaperName);
}

export const uploadWallpaper = (req: Request, res: Response) => {
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    upload(req, res, async function (err: any) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
            // If image size is bigger than the limit, send error response.

            errStatusCode = 413;
            errMessage = "Image size should not be bigger than 30 MB.";
            return;
        } else if (err) {
            // If file is not an image, send error response.
            // This err is set by the fileFilter function.

            errStatusCode = 415;
            errMessage = err.message;
            return;
        } else {
            // Otherwise, proceed with adding stuff to database.

            const file = req.file as Express.Multer.File;
            const title = req.body.title;
            const dimensions = sizeOf(file.path);
            const tags: string[] = req.body.tags;

            if (!title || !tags) {
                errStatusCode = 400;
                errMessage = "Either the title or the tags are missing from the request.";
                return;
            }

            // If either one or more tags in the tags array do not exist in the db,
            // return an error.
            const tagsExist = await confirmTagsExist(tags);
            if (!tagsExist) {
                errStatusCode = 409;
                errMessage = "Either one or more of the tags provided do not exist.";
                return;
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

                unlink(file.path)
                    .then(() => console.log("Uploaded file deleted because something went wrong."))
                    .catch(err => {
                        console.error("Something went wrong while deleting the uploaded file:\n", err);
                    });

                errStatusCode = 500;
                errMessage = "Something went wrong.";
            }
        }
    });

    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    return res.status(201).json({ message: "Wallpaper uploaded successfully." });
}

export const deleteWallpaper = async (req: Request, res: Response) => {
    const wallpaperId: string = req.params.id;
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    // Confirm that the wallpaper is "owned" by the logged in user.
    const isOwner = await confirmOwnership(wallpaperId, (req.user as IUser)._id);

    if (!isOwner) {
        return res.status(403).json({ message: "You cannot delete a wallpaper you did not post." });
    }

    try {
        const deletedWallpaper = await Wallpaper.findByIdAndDelete(wallpaperId);

        if (deletedWallpaper) {
            // Delete the file from filesystem
            await unlink(deletedWallpaper.imagePath)
                .catch(err => {
                    console.error("Something went wrong while deleting the wallpaper from fs:\n", err);
                });

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
            errStatusCode = 404;
            errMessage = "Wallpaper not found and could not be deleted.";
        }
    } catch (err) {
        console.error("There was an error while deleting the wallpapers:\n", err);
        errStatusCode = 500;
        errMessage = "Something went wrong.";
    }

    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    return res.status(200).json({ message: "Wallpaper deleted successfully." });
}

// Custom functions ===========================================

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