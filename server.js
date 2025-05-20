const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());  // Use express.json() instead of bodyParser.json()

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Mongo Schema
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
}));

// API routes - place before static serving
app.post('/add-user', async (req, res) => {
  try {
    console.log('Incoming /add-user request body:', req.body);

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = new User({ username, password });
    await user.save();

    res.json({ message: 'User saved successfully' });
  } catch (error) {
    console.error('❌ Error in /add-user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
