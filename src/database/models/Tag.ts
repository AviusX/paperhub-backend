import { Schema, model } from 'mongoose';

const tagSchema = new Schema({
    title: { type: String, required: true },
    wallpapers: [Schema.Types.ObjectId]
});

export default model("Tag", tagSchema);