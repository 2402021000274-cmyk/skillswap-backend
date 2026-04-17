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

app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST", "PUT", "DELETE"]
    },
    maxHttpBufferSize: 1e8 
});

const onlineUsers = new Map(); 

let SURPRISE_MODE = false; 

let totalVisitors = 0; 

const statSchema = new mongoose.Schema({ name: String, count: Number });
const SystemStat = mongoose.models.SystemStat || mongoose.model('SystemStat', statSchema);

io.on('connection', (socket) => {
    
    socket.emit('visitor-update', totalVisitors);

    socket.on('register-user', async (data) => {
        let email = data.email || data;
        let isNewLogin = data.isNewLogin || false;
        
        onlineUsers.set(email, socket.id);
        
        if (isNewLogin) {
            totalVisitors++;
            io.emit('visitor-update', totalVisitors);
            try {
                await SystemStat.findOneAndUpdate(
                    { name: 'totalVisitors' }, 
                    { count: totalVisitors }, 
                    { upsert: true }
                );
            } catch(e) { console.log("Stat save error", e); }
        } else {
            socket.emit('visitor-update', totalVisitors);
        }
        
        io.emit('user-status-update', { email: email, status: true }); 
    });

    socket.on('send-msg', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('receive-msg', data);
        }
    });

    socket.on('send-translation', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('receive-translation', data);
        }
    });

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

    socket.on('share-notes', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('receive-notes', { notes: data.notes });
        }
    });

    socket.on('sync-note-page', (data) => {
        const receiverSocket = onlineUsers.get(data.to);
        if (receiverSocket) {
            io.to(receiverSocket).emit('sync-note-page', { pageIndex: data.pageIndex });
        }
    });

    // 🟢 NEW FIX: Mentor khud session end kare toh Learner ko popup dikhane ka socket
    socket.on('trigger-user-review', (data) => {
        io.emit('force-review-modal', data);
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
          
          let stat = await SystemStat.findOne({ name: 'totalVisitors' });
          if (!stat) {
              stat = new SystemStat({ name: 'totalVisitors', count: 0 });
              await stat.save();
          }
          totalVisitors = stat.count;
          console.log(`📊 Permanent Visitor Count Loaded: ${totalVisitors}`);
          
      } catch(e) { console.log('Index creation skipped.'); }
  })
  .catch((err) => console.log('❌ Database Connection Error:', err.message));


const userSchema = new mongoose.Schema({ email: { type: String, unique: true } }, { strict: false });
const User = mongoose.models.User || mongoose.model('User', userSchema);

app.post('/register', async (req, res) => {
    if (SURPRISE_MODE) return res.status(403).json({ message: "🚧 System abhi Maintenance Mode me gaya he! Please thodi der wait karein." });

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
    if (SURPRISE_MODE) return res.status(403).json({ message: "🚧 System abhi Maintenance Mode me gaya he! Please thodi der wait karein." });

    try {
        const { email, password } = req.body;
        const cleanEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(404).json({ message: "Account not found! Please register first." });
        if (user.password !== password) return res.status(401).json({ message: "Incorrect Password! Please try again." });
        res.status(200).json({ message: "Login Successful!", user: user });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/send-otp', async (req, res) => {
    try {
        const cleanEmail = req.body.email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: cleanEmail });
        if (!existingUser) return res.status(404).json({ message: "This email is not registered in our database." });
        res.status(200).json({ message: "OTP sent successfully to your email!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() }, 
            { $set: { password: newPassword } }, 
            { returnDocument: 'after' }
        );
        if (!updatedUser) return res.status(404).json({ message: "User not found, password update failed." });
        res.status(200).json({ message: "Password updated successfully! Please log in." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 🟢 NEW FIX: Submit Review - Skill Specific Calculation
app.post('/submit-review', async (req, res) => {
    try {
        const { targetEmail, reviewerEmail, reviewerName, rating, comment, skill } = req.body;
        const user = await User.findOne({ email: targetEmail.trim().toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        const newReview = { reviewerEmail, reviewerName, rating: Number(rating), comment, skill, date: new Date() };
        let reviews = user.reviews || [];
        reviews.push(newReview);

        // 🟢 Naya Data Structure: Har skill ka alag average calculate hoga
        let skillRatings = user.skillRatings || {};
        let targetSkill = skill || "General";
        
        if (!skillRatings[targetSkill]) {
            skillRatings[targetSkill] = { totalReviews: 0, averageRating: 0, sum: 0 };
        }

        skillRatings[targetSkill].sum += Number(rating);
        skillRatings[targetSkill].totalReviews += 1;
        skillRatings[targetSkill].averageRating = Number((skillRatings[targetSkill].sum / skillRatings[targetSkill].totalReviews).toFixed(1));

        let totalReviews = reviews.length;
        let sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
        let averageRating = (sum / totalReviews).toFixed(1);

        await User.findOneAndUpdate(
            { email: targetEmail.trim().toLowerCase() },
            { $set: { 
                reviews: reviews, 
                skillRatings: skillRatings, // Skill wise rating push
                totalReviews: totalReviews, 
                averageRating: Number(averageRating) 
            } }
        );
        
        io.emit('user-status-update', { email: targetEmail.trim().toLowerCase(), status: true });
        res.status(200).json({ message: "Review submitted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
            { returnDocument: 'after' }
        );
        res.json({ message: "Update Success!", user: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/delete-user/:email', async (req, res) => {
    try {
        const deletedUser = await User.deleteOne({ email: req.params.email.trim().toLowerCase() });
        if (deletedUser.deletedCount > 0) res.json({ message: "User deleted successfully!" });
        else res.status(404).json({ message: "User not found!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/api/ai", async (req, res) => {
    const { message } = req.body;
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer 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 ", 
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inputs: message })
            }
        );
        const data = await response.json();
        
        if (data.error) {
             return res.json({ reply: "AI Model is warming up... Please try again in 20 seconds." });
        }

        res.json({ reply: data[0]?.generated_text || "I didn't quite get that. Could you rephrase?" });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: "My AI brain is resting. Try again!" });
    }
});

// ==========================================
// 🟢 ADMIN API ROUTES
// ==========================================

app.get('/admin/all-users', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }); 
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching users" });
    }
});

app.delete('/admin/delete-user/:email', async (req, res) => {
    try {
        await User.deleteOne({ email: req.params.email.trim().toLowerCase() });
        res.json({ message: "User deleted by Admin successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user" });
    }
});

app.put('/admin/update-credits/:email', async (req, res) => {
    try {
        const { credits } = req.body;
        await User.findOneAndUpdate(
            { email: req.params.email.trim().toLowerCase() },
            { $set: { credits: credits } }
        );
        res.json({ message: "Credits updated by Admin!" });
    } catch (error) {
        res.status(500).json({ message: "Error updating credits" });
    }
});

app.post('/admin/force-end-swap', async (req, res) => {
    try {
        const { providerEmail, requesterEmail, skill, topic } = req.body;
        
        let provider = await User.findOne({ email: providerEmail }).lean();
        let requester = await User.findOne({ email: requesterEmail }).lean();

        if(provider && requester) {
            let pSwaps = provider.swaps || [];
            pSwaps = pSwaps.filter(s => !(s.partnerEmail === requesterEmail && s.skill === skill));
            
            let pNotis = provider.notifications || [];
            pNotis.push({ text: `🛡️ Admin safely ended your session. You received 1 Credit for teaching '${skill}'.`, isRead: false, id: Date.now() });

            await User.updateOne(
                { email: providerEmail },
                { $set: { 
                    credits: (provider.credits || 0) + 1, 
                    swaps: pSwaps, 
                    notifications: pNotis 
                }}
            );

            let rSwaps = requester.swaps || [];
            rSwaps = rSwaps.filter(s => !(s.partnerEmail === providerEmail && s.skill === skill));
            
            let rAcquired = requester.acquiredSkills || [];
            let learnedTopic = topic || "General (Full Skill)";
            let alreadyLearned = rAcquired.some(item => 
                (typeof item === 'object' && item.skill === skill && item.topic === learnedTopic) || 
                (typeof item === 'string' && item === skill && learnedTopic === "General (Full Skill)")
            );
            
            if (!alreadyLearned) {
                rAcquired.push({ skill: skill, topic: learnedTopic });
            }

            let rNotis = requester.notifications || [];
            rNotis.push({ text: `🛡️ Admin ended the session. You successfully learned '${learnedTopic}' in ${skill}.`, isRead: false, id: Date.now() });

            await User.updateOne(
                { email: requesterEmail },
                { $set: { 
                    swaps: rSwaps, 
                    acquiredSkills: rAcquired, 
                    notifications: rNotis 
                }}
            );

            io.emit('user-status-update', { email: providerEmail, status: true });
            io.emit('user-status-update', { email: requesterEmail, status: true });

            res.json({ message: "Session Force Ended Successfully!" });
        } else {
            res.status(404).json({ message: "Users not found." });
        }
    } catch (error) {
        console.error("Force End Error:", error);
        res.status(500).json({ message: "Error forcing end session" });
    }
});

app.post('/admin/trigger-review', async (req, res) => {
    try {
        const { providerEmail, requesterEmail, skill } = req.body;
        io.emit('force-review-modal', { providerEmail, requesterEmail, skill });
        res.json({ message: "Review prompt sent successfully!" });
    } catch (error) {
        console.error("Trigger Review Error:", error);
        res.status(500).json({ message: "Error triggering review" });
    }
});

app.get('/admin/maintenance-status', (req, res) => {
    res.json({ isMaintenance: SURPRISE_MODE });
});

app.post('/admin/toggle-maintenance', (req, res) => {
    SURPRISE_MODE = req.body.isMaintenance;
    io.emit('maintenance-mode', SURPRISE_MODE); 
    res.json({ message: "Maintenance mode updated", isMaintenance: SURPRISE_MODE });
});

app.get('/', (req, res) => { res.send('🚀 Backend is Live!'); });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { console.log(`🚀 Server & Real-time Socket are running on port ${PORT}`); });
