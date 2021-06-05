import { Document, Types } from 'mongoose';

interface IUser extends Document {
    discordId: string;
    username: string;
    clout: number;
    postedWallpapers: Types.ObjectId[];
}

export default IUser;