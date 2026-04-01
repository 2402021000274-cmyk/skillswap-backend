const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // 🔥 YE LINE MISSING THI, ab password save hoga
    skill: { type: String, required: true },
    credits: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
