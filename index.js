import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS beállítás
app.use(cors({
  origin: 'https://trigger.bio',
  methods: ['GET', 'POST', 'PUT'],  // PUT hozzáadva
  credentials: false,
}));

app.use(bodyParser.json());

// 📁 Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, 'public')));

// --- Statikus mappa az uploads fájlokhoz ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

  // Új mezők a profil testreszabáshoz
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },
  links: [{
    label: String,
    url: String,
    icon: String,
  }],
  bgVideoUrl: { type: String, default: '' },
  specialText: { type: String, default: '' },
  animation: { type: String, default: '' },
  musicUrl: { type: String, default: '' },
});

const User = mongoose.model('User', userSchema);

// --- Multer beállítás fájlfeltöltéshez ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

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
      profileImage: user.profileImage,
      bio: user.bio,
      links: user.links,
      bgVideoUrl: user.bgVideoUrl,
      specialText: user.specialText,
      animation: user.animation,
      musicUrl: user.musicUrl
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Dinamikus route profil oldal megjelenítéséhez ---
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

// --- Profilkép feltöltés endpoint ---
app.post('/api/upload-profile-image/:userId', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profileImage = imageUrl;
    await user.save();

    res.json({ url: imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- Profiladatok frissítése (username, bio, links stb.) ---
app.put('/api/user/:userId', async (req, res) => {
  try {
    const updateData = req.body;

    delete updateData.passwordHash;
    delete updateData.password;

    const user = await User.findByIdAndUpdate(req.params.userId, updateData, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: 'User updated successfully',
      user: {
        username: user.username,
        email: user.email,
        customUrl: user.customUrl,
        profileImage: user.profileImage,
        bio: user.bio,
        links: user.links,
        bgVideoUrl: user.bgVideoUrl,
        specialText: user.specialText,
        animation: user.animation,
        musicUrl: user.musicUrl,
      }
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🚀 Indítás
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
