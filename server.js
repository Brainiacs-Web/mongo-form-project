const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/public')));

// Connect to MongoDB
mongoose.connect('mongodb+srv://brainiacsypt:IWv5NNn1IvIPWvw8@cluster0.ryi31nz.mongodb.net/mydb?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mongo Schema
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
}));

// Add user
app.post('/add-user', async (req, res) => {
  const { username, password } = req.body;
  const user = new User({ username, password });
  await user.save();
  res.json({ message: 'User saved' });
});

// Get users
app.get('/get-users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
