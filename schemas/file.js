const mongoose = require('mongoose');

const { Schema } = mongoose;
const newSchema = new Schema({
    filename: {
        type: String,
        required: true,
        unique: true
    },
    secretkey: {
        type: String,
        required: true
    },
    limit: {
        type: Number,
        requried: true
    },
    originalname: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('File', newSchema);