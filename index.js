import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS beállítás
app.use(cors({
  origin: 'https://trigger.bio',
  methods: ['GET', 'POST'],
  credentials: false,
}));

app.use(bodyParser.json());

// 📁 Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 MongoDB kapcsolat
const MONGO_URI = 'mongodb+srv://fadmivan:BKD9wI5zlnPHw88Q@thsnd.y6dalxq.mongodb.net/thsnd?retryWrites=true&w=majority&appName=thsnd';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// 📦 Felhasználó séma
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 4, maxlength: 20 },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  customUrl: { type: String, required: true, unique: true, minlength: 3 },
});

const User = mongoose.model('User', userSchema);

// 📩 Regisztráció
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, customUrl } = req.body;

    if (!username || username.length < 4 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 4-20 characters long.' });
    }
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!customUrl || !customUrl.match(/^[a-zA-Z0-9-_]{3,}$/)) {
      return res.status(400).json({ error: 'Custom URL invalid.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }, { customUrl }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username, email or custom URL already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, passwordHash, customUrl });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// 🔐 Bejelentkezés
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    res.status(200).json({
      message: 'Login successful.',
      user: {
        username: user.username,
        email: user.email,
        customUrl: user.customUrl
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// 🔍 API: Egyedi user lekérdezése
app.get('/api/user/:customUrl', async (req, res) => {
  try {
    const user = await User.findOne({ customUrl: req.params.customUrl });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      username: user.username,
      customUrl: user.customUrl,
      email: user.email,
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ⚠️ Dinamikus route: trigger.bio/thsnd
app.get('/:customUrl', async (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.includes('.') || // .html, .css, .js stb.
    req.path === '/favicon.ico'
  ) return next();

  try {
    const user = await User.findOne({ customUrl: req.params.customUrl });
    if (!user) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
  } catch (error) {
    console.error('Custom URL page error:', error);
    res.status(500).send('Server error');
  }
});

// 🚀 Indítás
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
