import { Document, Types } from 'mongoose';

interface IWallpaper extends Document {
    owner: Types.ObjectId;
    title: string;
    imagePath: string;
    mimeType: string;
    width: number;
    height: number;
    tags?: string[];
    downloadCount?: number;
}

export default IWallpaper;