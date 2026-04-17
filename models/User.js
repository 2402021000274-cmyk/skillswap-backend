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

    swaps: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
    chatHistory: { type: Object, default: {} },
    isOnline: { type: Boolean, default: false },

    // 🟢 NEW FIELDS FOR REVIEW SYSTEM:
    totalReviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviews: { type: Array, default: [] }

}, { strict: false });

module.exports = mongoose.model('User', userSchema);
