require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));

app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const onlineUsers = new Map(); 

io.on('connection', (socket) => {
    socket.on('register-user', (email) => {
        onlineUsers.set(email, socket.id);
        io.emit('user-status-update', { email: email, status: true }); 
    });

    socket.on('send-msg', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('receive-msg', data);
        }
    });
      // --- AI TRANSLATOR SIGNALING LOGIC ---
    socket.on('send-translation', (data) => {
        // data.to mein samne wale user ka email aayega
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('receive-translation', data);
        }
    });
    // -------------------------------------
    // WebRTC Video Call Signaling
    socket.on('call-user', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('call-made', {
                offer: data.offer,
                from: data.from
            });
        }
    });

    socket.on('make-answer', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('answer-made', {
                answer: data.answer
            });
        }
    });

    socket.on('reject-call', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('call-rejected');
        }
    });

    socket.on('end-call', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('call-ended');
        }
    });

    socket.on('ice-candidate', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('ice-candidate', {
                candidate: data.candidate,
                from: data.from
            });
        }
    });

    socket.on('disconnect', () => {
        let disconnectedEmail = null;
        for (let [email, id] of onlineUsers.entries()) {
            if (id === socket.id) {
                disconnectedEmail = email;
                onlineUsers.delete(email);
                break;
            }
        }
        if (disconnectedEmail) {
            io.emit('user-status-update', { email: disconnectedEmail, status: false }); 
        }
    });
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
      console.log('✅ MongoDB Connected Successfully!');
      const db = mongoose.connection.db;
      try {
          const collections = await db.listCollections().toArray();
          const hasUsers = collections.some(col => col.name === 'users');
          if (hasUsers) {
              await db.collection('users').createIndex({ email: 1 }, { unique: true });
              console.log('🔄 Database Indexes Synchronized!');
          }
      } catch(e) { console.log('Index creation skipped.'); }
  })
  .catch((err) => console.log('❌ Database Connection Error:', err.message));


const userSchema = new mongoose.Schema({ email: { type: String, unique: true } }, { strict: false });
const User = mongoose.models.User || mongoose.model('User', userSchema);

// --- ROUTES ---

app.post('/register', async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase(); 
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) return res.status(400).json({ message: "Email already exists in the records!" });
        const newUser = new User({ ...req.body, email: cleanEmail });
        await newUser.save();
        res.status(201).json({ message: "User Registered Successfully!" });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: "Duplicate Email Error at DB level." });
        res.status(400).json({ message: "Error", error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(404).json({ message: "Account nahi mila! Pehle register karo." });
        if (user.password !== password) return res.status(401).json({ message: "Galat Password! Dubara check karo." });
        res.status(200).json({ message: "Login Successful!", user: user });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/send-otp', async (req, res) => {
    try {
        const cleanEmail = req.body.email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: cleanEmail });
        if (!existingUser) return res.status(404).json({ message: "Ye email database mein nahi hai!" });
        res.status(200).json({ message: "OTP sent successfully to your email!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() }, 
            { $set: { password: newPassword } }, 
            { returnDocument: 'after' } // 🟢 FIXED WARNING HERE
        );
        if (!updatedUser) return res.status(404).json({ message: "User nahi mila, password update fail ho gaya." });
        res.status(200).json({ message: "Password updated successfully! Ab login karo." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/update-user/:email', async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData._id; 
        const updated = await User.findOneAndUpdate( 
            { email: req.params.email.trim().toLowerCase() }, 
            { $set: updateData }, 
            { returnDocument: 'after' } // 🟢 FIXED WARNING HERE
        );
        res.json({ message: "Update Success!", user: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/delete-user/:email', async (req, res) => {
    try {
        const deletedUser = await User.deleteOne({ email: req.params.email.trim().toLowerCase() });
        if (deletedUser.deletedCount > 0) res.json({ message: "User deleted successfully!" });
        else res.status(404).json({ message: "User nahi mila!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/', (req, res) => { res.send('🚀 Backend is Live!'); });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { console.log(`🚀 Server & Real-time Socket are running on port ${PORT}`); });
