require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();

// 🟢 CORS Configuration
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));

app.use(express.json({ limit: '10mb' }));

// 🛠️ DATABASE CONNECTION 
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Database Connected Successfully!'))
  .catch((err) => console.log('❌ Database Connection Error:', err.message));

// --- ROUTES (Updated to use User Model) ---

// 1. Naya User Register karne ke liye 
app.post('/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ message: "User Registered Successfully!" });
    } catch (error) {
        res.status(400).json({ message: "Error registering user", error: error.message });
    }
});

// 2. Saare Users ki list dekhne ke liye 
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. 🔄 Chat, Swaps, aur Profile Live Update
app.put('/update-user/:email', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id; 
        
        const updated = await User.findOneAndUpdate(
            { email: req.params.email },
            { $set: updateData },
            { new: true }
        );
        res.json({ message: "Data live updated on Cloud!", user: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. 🗑️ User Delete karne ka Route 
app.delete('/delete-user/:email', async (req, res) => {
    try {
        const deletedUser = await User.deleteOne({ email: req.params.email });
        if (deletedUser.deletedCount > 0) {
            res.json({ message: "User deleted from MongoDB successfully!" });
        } else {
            res.status(404).json({ message: "User nahi mila!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Server check
app.get('/', (req, res) => {
    res.send('🚀 Skill Swap Backend is Running Perfectly!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
