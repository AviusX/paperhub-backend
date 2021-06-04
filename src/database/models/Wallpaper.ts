import { Schema, model } from 'mongoose';

const wallpaperSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    imagePath: { type: String, required: true },
    resolution: { type: String, required: true },
    tags: [Schema.Types.ObjectId],
    postedAt: { type: Date, default: Date.now },
    likes: [Schema.Types.ObjectId]
});

export default model("Wallpaper", wallpaperSchema);