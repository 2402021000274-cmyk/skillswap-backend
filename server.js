require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User'); 

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));

app.use(express.json({ limit: '10mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
      console.log('✅ MongoDB Connected Successfully!');
      await User.syncIndexes();
      console.log('🔄 Database Indexes Synchronized!');
  })
  .catch((err) => console.log('❌ Database Connection Error:', err.message));

// --- ROUTES ---

app.post('/register', async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase(); 

        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists in the records!" });
        }

        const newUser = new User({
            ...req.body,
            email: cleanEmail
        });

        await newUser.save();
        res.status(201).json({ message: "User Registered Successfully!" });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Duplicate Email Error at DB level." });
        }
        res.status(400).json({ message: "Error", error: error.message });
    }
});

// 🔐 LOGIN ROUTE (Email aur Password ke sath)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            return res.status(404).json({ message: "Account nahi mila! Pehle register karo." });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: "Galat Password! Dubara check karo." });
        }

        res.status(200).json({ message: "Login Successful!", user: user });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({ email: cleanEmail });
        if (!existingUser) {
            return res.status(404).json({ message: "Ye email database mein nahi hai!" });
        }
        res.status(200).json({ message: "OTP sent successfully to your email!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        const updatedUser = await User.findOneAndUpdate(
            { email: cleanEmail }, 
            { $set: { password: newPassword } }, 
            { new: true } 
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User nahi mila, password update fail ho gaya." });
        }
        res.status(200).json({ message: "Password updated successfully! Ab login karo." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/update-user/:email', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id; 
        
        const updated = await User.findOneAndUpdate(
            { email: req.params.email.trim().toLowerCase() },
            { $set: updateData },
            { new: true }
        );
        res.json({ message: "Update Success!", user: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/delete-user/:email', async (req, res) => {
    try {
        const deletedUser = await User.deleteOne({ email: req.params.email.trim().toLowerCase() });
        if (deletedUser.deletedCount > 0) {
            res.json({ message: "User deleted successfully!" });
        } else {
            res.status(404).json({ message: "User nahi mila!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('🚀 Backend is Live!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
