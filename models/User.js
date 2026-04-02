const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    role: { type: String },
    skill: { type: String },
    profilePic: { type: String },
    is2FAEnabled: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    credits: { type: Number, default: 5 },

    // 🟢 NAYE FIELDS: Ye Mongoose ko batayega ki inko save karna hai
    swaps: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
    chatHistory: { type: Object, default: {} },
    isOnline: { type: Boolean, default: false }

}, { strict: false }); // 🔥 MAIN FIX: Ye MongoDB ko future me bhi har naya data save karne ki permission dega

module.exports = mongoose.model('User', userSchema);
