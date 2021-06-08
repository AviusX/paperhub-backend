import { Document, Types } from 'mongoose';

interface IWallpaper extends Document {
    owner: Types.ObjectId;
    title: string;
    imagePath: string;
    width: number;
    height: number;
    tags?: Types.ObjectId[];
    likes?: Types.ObjectId[];
}

export default IWallpaper;