import { Document, Types } from 'mongoose';

interface ITag extends Document {
    title: string;
    wallpapers: Types.ObjectId[];
}

export default ITag;