import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Statikus fájlok kiszolgálása a 'public' mappából
app.use(express.static(path.join(process.cwd(), 'public')));

// MongoDB csatlakozás
const MONGO_URI = 'mongodb+srv://fadmivan:BKD9wI5zlnPHw88Q@thsnd.y6dalxq.mongodb.net/thsnd?retryWrites=true&w=majority&appName=thsnd';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Felhasználó séma
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 4, maxlength: 20 },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  customUrl: { type: String, required: true, unique: true, minlength: 3 },
});

const User = mongoose.model('User', userSchema);

// Regisztrációs végpont
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, customUrl } = req.body;

    // Egyszerű validáció
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

    // Ellenőrzés, hogy van-e már ilyen felhasználó vagy URL
    const existingUser = await User.findOne({ $or: [{ username }, { email }, { customUrl }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username, email or custom URL already taken.' });
    }

    // Jelszó hash-elése
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Új felhasználó létrehozása
    const newUser = new User({
      username,
      email,
      passwordHash,
      customUrl,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Opció: ha valaki nem létező útvonalat kér (pl. frontend routing miatt),
// vissza lehet irányítani a register.html-re vagy más alapoldalra.
// Itt egy példa:
// Figyelj rá, hogy az 'app.get' ne ütközzön az API útvonalakkal.
// Javítsd így:
app.get('/api/:id', (req, res) => {
  // valami konkrét kód itt
  res.sendFile(path.join(process.cwd(), 'public', 'register.html'));
});

// Szerver indítása
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
