import { Schema, model } from 'mongoose';

const tagSchema = new Schema({
    title: {
        type: String,
        lowercase: true, // always convert tag title to lowercase before storing in db.
        unique: true, // tag title must be unique.
        dropDrups: true, // any attempts to create tags with duplicate titles with be dropped.
        required: true
    },
    wallpapers: [Schema.Types.ObjectId]
});

export default model("Tag", tagSchema);