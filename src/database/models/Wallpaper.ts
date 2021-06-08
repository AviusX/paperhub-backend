import { Schema, model } from 'mongoose';
import IWallpaper from '../interfaces/IWallpaper';

const wallpaperSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    imagePath: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    tags: [Schema.Types.ObjectId],
    postedAt: { type: Date, default: Date.now },
    likes: [Schema.Types.ObjectId]
});

export default model<IWallpaper>("Wallpaper", wallpaperSchema);