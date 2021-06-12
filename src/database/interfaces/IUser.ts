import { Document, Types } from 'mongoose';
import { PermissionLevel } from '../../enums/PermissionLevel';

interface IUser extends Document {
    discordId: string;
    username: string;
    discriminator: string;
    postedWallpapers: Types.ObjectId[];
    permissionLevel: PermissionLevel;
}

export default IUser;