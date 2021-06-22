import { Request, Response } from 'express';
import IUser from '../../database/interfaces/IUser';
import { PermissionLevel } from '../../enums/PermissionLevel';
import Tag from '../../database/models/Tag';
import { tagSchema } from '../../validation/tag';
import ITag from '../../database/interfaces/ITag';

export const getTags = async (req: Request, res: Response) => {
    let errStatusCode: number | undefined;
    let errMessage: string | undefined;
    let tags: ITag[];
    const tagTitles = [];

    try {
        tags = await Tag.find();
    } catch (err) {
        console.error("There was an error while fetching tags:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

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

    try {
        tag = await Tag.find({ title });
    } catch (err) {
        console.error("Something went wrong while fetching a tag:\n", err);
        return res.status(500).json({ message: "Something went wrong." });

    }

    if (tag) {
        return res.status(200).json(tag);
    } else {
        return res.status(404).json({ message: "Tag not found." });
    }
}

export const createTag = async (req: Request, res: Response) => {
    const permissionLevel = (req.user as IUser).permissionLevel;
    const title = req.body.title;

    const { error: validationError } = tagSchema.validate({ title });

    if (validationError) {
        return res.status(400).json({ message: validationError.message });
    }

    // If the user does not have a PermissionLevel of Developer,
    // stop them from being able to add a tag.
    if (permissionLevel !== PermissionLevel.Developer) {
        return res.status(403).json({ message: "You are not authorized to perform this action." });
    }

    try {
        const tagExists = await Tag.exists({ title });
        // If a tag with the given title already exists, return error.
        if (tagExists) {
            return res.status(409).json({ message: "A tag with that title already exists." });
        }
    } catch (err) {
        console.error("Something went wrong while confirming that the tag exists:\n", err);
    }

    try {
        await Tag.create({ title });
    } catch (err) {
        console.error("There was an error while creating a tag:\n", err);
        return res.status(500).json({ message: "Something went wrong." });
    }

    return res.status(201).json({ message: "Tag successfully created." });
}