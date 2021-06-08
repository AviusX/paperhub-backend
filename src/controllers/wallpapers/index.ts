import User from '../../database/models/User';
import Wallpaper from '../../database/models/Wallpaper';
import IUser from '../../database/interfaces/IUser';
import { Request, Response } from 'express';
import multer, { MulterError, FileFilterCallback } from 'multer';
import { unlink } from 'fs/promises';
import sizeOf from 'image-size';

// Good StackOverflow answer for fileFilter-
// https://stackoverflow.com/a/65378054/10509081

const upload = multer({
    dest: 'uploads/wallpapers',
    limits: {
        fileSize: 1024 * 1024 * 30 // Allow a max of 30 MB image size.
    },
    fileFilter
}).array('wallpapers', 10);

export const uploadWallpaper = (req: Request, res: Response) => {
    upload(req, res, async function (err: any) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
            // If image size is bigger than the limit, send error response.

            res.status(413).json({
                message: "Image size should not be bigger than 30 MB."
            });
        } else if (err instanceof MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
            // If there are more than 10 files being uploaded at once, send error response.

            res.status(413).json({
                message: "You cannot upload more than 10 files at once."
            });
        } else if (err) {
            // If file is not an image, send error response.

            res.status(415).json({ message: err.message });
        } else {
            // Otherwise, proceed with adding stuff to database.

            const files = req.files as Express.Multer.File[];
            for (let file of files) {
                const dimensions = sizeOf(file.path);

                // Save the wallpaper to the database
                await new Wallpaper({
                    owner: (req.user as IUser)._id,
                    title: file.originalname,
                    imagePath: file.path,
                    width: dimensions.width,
                    height: dimensions.height,
                })
                    .save()
                    .then(newWallpaper => {
                        // Add the newly created wallpaper's reference to the owner's 
                        // model as well.
                        return User.findOneAndUpdate({
                            _id: (req.user as IUser)._id // Find the owner
                        }, {
                            $push: { postedWallpapers: newWallpaper._id } // Push new wallpaper
                        }, { useFindAndModify: false } // options
                        );
                    })
                    .then(() => {
                        res.status(201).json({ message: "Wallpaper(s) uploaded successfully" });
                    })
                    .catch(err => {
                        // If wallpaper cannot be added to the database for some reason,
                        // delete the uploaded file from the filesystem to prevent piling
                        // up of useless image files.
                        res.status(500).json({ message: "Something went wrong." });
                        console.error(err);
                        unlink(file.path)
                            .then(() => console.log("Uploaded file deleted because something went wrong"))
                            .catch(err => {
                                console.error("Something went wrong while deleting the uploaded file", err);
                            });
                    });
            }
        }
    });
}

// Custom functions ===========================================
function fileFilter(req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    const fileType = /^image\//;

    // If the file was not an image, throw error.
    // else, save the image to filesystem.
    if (!fileType.test(file.mimetype)) {
        cb(new Error("Uploaded file was not an image."));
    } else {
        cb(null, true);
    }
}