import { Request, Response } from 'express';
import IUser from '../../database/interfaces/IUser';
import { PermissionLevel } from '../../enums/PermissionLevel';
import Tag from '../../database/models/Tag';
import ITag from '../../database/interfaces/ITag';

export const getTags = async (req: Request, res: Response) => {
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    const tags: ITag[] = await Tag.find()
        .catch((err: any) => {
            console.error("There was an error while fetching tags:\n", err);
            errStatusCode = 500;
            errMessage = "Something went wrong.";
        });
    const tagTitles = [];

    for (let tag of tags) {
        tagTitles.push(tag.title);
    }

    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    return res.status(200).json(tagTitles);
}

export const getTag = async (req: Request, res: Response) => {
    const title = req.params.title;

    // Assigned if tag is successfully found-
    let tag: ITag | undefined;

    // Assigned if something goes wrong during db operations.
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    await Tag.find({ title })
        .then((foundTag: ITag) => {
            if (foundTag) {
                tag = foundTag;
            } else {
                errStatusCode = 404;
                errMessage = "Tag not found";
            }
        })
        .catch((err: any) => {
            console.error("Something went wrong while fetching a tag:\n", err);
            errStatusCode = 500;
            errMessage = "Something went wrong.";
        });

    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    return res.status(200).json(tag);
}

export const createTag = async (req: Request, res: Response) => {
    const permissionLevel = (req.user as IUser).permissionLevel;
    const title = req.body.title;
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;

    // If the user does not have a PermissionLevel of Developer,
    // stop them from being able to add a tag.
    if (permissionLevel !== PermissionLevel.Developer) {
        return res.status(403).json({ message: "You are not authorized to perform this action." });
    }

    // If a tag with the given title already exists, return error.
    if (await Tag.exists({ title })) {
        return res.status(409).json({ message: "A tag with that title already exists." });
    }

    await new Tag({
        title
    })
        .save()
        .catch((err: any) => {
            console.error("There was an error while creating a tag:\n", err);
            errStatusCode = 500;
            errMessage = "Something went wrong.";
        })

    if (errStatusCode && errMessage) {
        return res.status(errStatusCode).json({ message: errMessage });
    }

    return res.status(201).json({ message: "Tag successfully created." });
}