import { Schema, model } from 'mongoose';
import IUser from '../interfaces/IUser';

const userSchema = new Schema({
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    clout: { type: Number, default: 0 },
    postedWallpapers: [Schema.Types.ObjectId]
});

export default model<IUser>("User", userSchema);