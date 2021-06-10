import { Document, Types } from 'mongoose';

interface IUser extends Document {
    discordId: string;
    username: string;
    discriminator: string;
    postedWallpapers: Types.ObjectId[];
}

export default IUser;