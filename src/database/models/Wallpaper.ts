import { Schema, model } from 'mongoose';
import IWallpaper from '../interfaces/IWallpaper';

const wallpaperSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    imagePath: { type: String, required: true },
    mimeType: { type: String, requried: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    tags: [Schema.Types.ObjectId],
    downloadCount: { type: Number, default: 0 },
    postedAt: { type: Date, default: Date.now },
});

export default model<IWallpaper>("Wallpaper", wallpaperSchema);