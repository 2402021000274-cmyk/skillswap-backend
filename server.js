require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();

// 🟢 FIX: Duplicate CORS hata kar ek single strong block banaya jo sab handle karega
app.use(cors({
    origin: '*', // Sabhi jagah se (Naroda/Ahmedabad) allow karega
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'] // Ngrok bypass allow kiya
}));

app.use(express.json({ limit: '10mb' })); // Badi profile pic aur chat history ke liye

// 🛠️ DATABASE CONNECTION 
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000, 
    family: 4 
})
  .then(() => console.log('✅ MongoDB Database Connected Successfully!'))
  .catch((err) => console.log('❌ Database Connection Error:', err.message));

// --- ROUTES ---

// 1. Naya User Register karne ke liye 
app.post('/register', async (req, res) => {
    try {
        await mongoose.connection.db.collection('users').insertOne(req.body);
        res.status(201).json({ message: "User Registered Successfully!" });
    } catch (error) {
        res.status(400).json({ message: "Error registering user", error: error.message });
    }
});

// 2. Saare Users ki list dekhne ke liye 
app.get('/users', async (req, res) => {
    try {
        const users = await mongoose.connection.db.collection('users').find().toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. 🔄 Chat, Swaps, aur Profile Live Update karne ke liye
app.put('/update-user/:email', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id; 
        
        await mongoose.connection.db.collection('users').updateOne(
            { email: req.params.email },
            { $set: updateData }
        );
        res.json({ message: "Data live updated on Cloud!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. 🗑️ User Delete karne ka Route 
app.delete('/delete-user/:email', async (req, res) => {
    try {
        const deletedUser = await mongoose.connection.db.collection('users').deleteOne({ email: req.params.email });
        if (deletedUser.deletedCount > 0) {
            res.json({ message: "User deleted from MongoDB successfully!" });
        } else {
            res.status(404).json({ message: "User nahi mila!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Server check karne ke liye base route
app.get('/', (req, res) => {
    res.send('🚀 Skill Swap Backend is Running Perfectly and accepting all requests!');
});

// 🛠️ FIX 2: Server ko '0.0.0.0' par set kiya taaki ye Global ho jaye
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Ready for Ngrok or External IP connection!`);
});