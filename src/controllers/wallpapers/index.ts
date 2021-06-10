import User from '../../database/models/User';
import Wallpaper from '../../database/models/Wallpaper';
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
    let wallpaperPath: string = ""; // This is assigned if wallpaper is found.

    // Assigned if anything goes wrong with db operations.
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    await Wallpaper.findById(wallpaperId)
        .then(wallpaper => {
            if (wallpaper) {
                wallpaperPath = wallpaper.imagePath;
                return wallpaper._id;
            } else {
                errStatusCode = 400;
                errMessage = "Wallpaper not found.";
            }
        })
        // If the wallpaper is found, we want to increment its download count by 1.
        .then(wallpaperId => {
            return Wallpaper.findOneAndUpdate(
                { _id: wallpaperId }, // Search for this wallpaper.
                { $inc: { downloadCount: 1 } }, // Increment the download count.
                { useFindAndModify: false } // options
            )
        })
        .catch(err => {
            console.error("Something went wrong while fetching the wallpaper.", err);
            errStatusCode = 500;
            errMessage = "Something went wrong.";
        });

    // If anything goes wrong, send the assigned error message & status code.
    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    // Get the path of uploads directory (which is supposed to be in project root)
    // by resolving a path using the path of this file.
    wallpaperPath = path.resolve(__dirname + '../../../../') + '/' + wallpaperPath
    return res.status(200).sendFile(wallpaperPath);
}

export const uploadWallpaper = (req: Request, res: Response) => {
    upload(req, res, async function (err: any) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
            // If image size is bigger than the limit, send error response.

            res.status(413).json({
                message: "Image size should not be bigger than 30 MB."
            });
        } else if (err) {
            // If file is not an image, send error response.
            // This err is set by the fileFilter function.

            res.status(415).json({ message: err.message });
        } else {
            // Otherwise, proceed with adding stuff to database.

            const file = req.file as Express.Multer.File;
            const title = req.body.title;

            const dimensions = sizeOf(file.path);

            // Save the wallpaper to the database
            await new Wallpaper({
                owner: (req.user as IUser)._id,
                title: title,
                imagePath: file.path,
                width: dimensions.width,
                height: dimensions.height,
            })
                .save()
                .then(newWallpaper => {
                    // Add the newly created wallpaper's reference to the owner's 
                    // model as well.
                    return User.findOneAndUpdate(
                        { _id: (req.user as IUser)._id }, // Find the owner
                        { $push: { postedWallpapers: newWallpaper._id } }, // Push new wallpaper
                        { useFindAndModify: false } // options
                    );
                })
                .then(() => {
                    res.status(201).json({ message: "Wallpaper uploaded successfully." });
                })
                .catch(err => {
                    // If wallpaper cannot be added to the database for some reason,
                    // delete the uploaded file from the filesystem to prevent piling
                    // up of useless image files.
                    res.status(500).json({ message: "Something went wrong." });
                    console.error("There was an error while uploading the wallpaper:\n", err);
                    unlink(file.path)
                        .then(() => console.log("Uploaded file deleted because something went wrong."))
                        .catch(err => {
                            console.error("Something went wrong while deleting the uploaded file:\n", err);
                        });
                });
        }
    });
}

export const deleteWallpapers = async (req: Request, res: Response) => {
    const wallpaperIds: string[] = req.body.ids;

    // If req.body.ids is empty or undefined, return bad request error.
    if (!wallpaperIds) {
        return res.status(400).json({ message: "The array of wallpaper ids was empty/undefined" });
    }

    // Confirm that all of the wallpapers in the array are "owned" by the logged in user.
    const isOwner = await confirmOwnership(wallpaperIds, (req.user as IUser)._id);
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    if (!isOwner) {
        return res.status(403).json({ message: "You cannot delete a wallpaper you did not post." });
    }

    // Delete each wallpaper from array and then
    // also delete them from the postedWallpapers array in user model.
    for (let wallpaperId of wallpaperIds) {
        await Wallpaper.findByIdAndDelete(wallpaperId)
            .then(deletedWallpaper => {
                // Delete the file from filesystem
                if (deletedWallpaper) {
                    unlink(deletedWallpaper.imagePath)
                        .catch(err => {
                            console.error("Something went wrong while deleting the wallpaper from fs:\n", err);
                        });

                    return User.updateOne(
                        { _id: (req.user as IUser)._id },
                        { $pull: { postedWallpapers: deletedWallpaper?._id } }
                    )
                } else {
                    errStatusCode = 404;
                    errMessage = "Wallpaper with the given id not found and could not be deleted.";
                }
            })
            .catch(err => {
                console.error("There was an error while deleting the wallpapers:\n", err);
                errStatusCode = 500;
                errMessage = "Something went wrong";
            });
    }
    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }
    return res.status(200).json({ message: "Wallpaper(s) deleted successfully" });
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
 * Takes an array of wallpaper ids and a user id
 * and confirms that the given user owns all of those wallpapers
 *
 * @param {string[]} wallpaperIds The array of wallpaper ids
 * @param {string} userId The user id that we wish to confirm as the owner
 */
async function confirmOwnership(wallpaperIds: string[], userId: string) {
    // If for any id in array, the user id does not match the owner,
    // return false
    for (let id of wallpaperIds) {
        await Wallpaper.findById(id)
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
    }
    // If all of the above wallpapers have the same owner as userId,
    // return true
    return true;
}