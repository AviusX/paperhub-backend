import { Schema, model } from 'mongoose';
import { PermissionLevel } from '../../enums/PermissionLevel';
import IUser from '../interfaces/IUser';

const userSchema = new Schema({
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    postedWallpapers: [Schema.Types.ObjectId],
    permissionLevel: { type: Number, default: PermissionLevel.User }
});

export default model<IUser>("User", userSchema);