const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const http = require('http');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Load environment variables
dotenv.config();

// Prevent server crash on uncaught errors
process.on('uncaughtException', function (err) {
  console.error('Caught exception: ', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);

app.use(session({
  secret: process.env.SESSION_SECRET || 'gram-panchayat-water-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // 1 year persistent session
}));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Database Setup (MongoDB with Serverless Caching) ───────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://atharvajadhav20075848_db_user:T6Xj3t4KOCtpfbXT@cluster0.hrxwdsn.mongodb.net/?appName=Cluster0";

let isConnecting = false;
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (isConnecting) {
    await new Promise(resolve => mongoose.connection.once('open', resolve));
    return mongoose.connection;
  }
  try {
    isConnecting = true;
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB Live Database!');
    await seedDefaultUsers();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
  } finally {
    isConnecting = false;
  }
}
connectToDatabase();

app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    await connectToDatabase();
  }
  
  // Global Session Auto-Hydration for Serverless environments
  if (!req.session.user && req.headers['x-user-email']) {
    try {
      const decodedEmail = decodeURIComponent(req.headers['x-user-email']).toLowerCase().trim();
      const user = await User.findOne({ email: decodedEmail });
      if (user) {
        req.session.user = {
          email: user.email,
          name: user.email.split('@')[0],
          role: user.role,
          ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
          location: 'Saved Device',
          loginTime: new Date().toISOString()
        };
      }
    } catch(e) {}
  }
  next();
});

// ── Schemas & Models ──────────────────────────────────────────────────
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: 'People/User' }
}));

const Issue = mongoose.models.Issue || mongoose.model('Issue', new mongoose.Schema({
  id: { type: Number, required: true },
  title: String,
  type: String,
  description: String,
  location: String,
  lat: Number,
  lon: Number,
  photoUrl: String,
  reporter: { type: String, default: 'Resident' },
  reporterEmail: { type: String, default: '' },
  status: { type: String, default: 'Pending' },
  resolvedBy: String,
  resolutionPhotoUrl: String,
  createdAt: { type: Date, default: Date.now }
}));

const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  senderName: { type: String, default: 'Gram Panchayat' },
  senderRole: { type: String, default: 'System' },
  targetRole: { type: String, default: 'all' }, // 'all', 'People/User', 'Sarpanch', 'Admin'
  targetEmail: { type: String, default: '' },
  type: { type: String, default: 'general' }, // 'issue', 'broadcast', 'general'
  isEmergency: { type: Boolean, default: false },
  soundUrl: { type: String, default: null },
  playOnce: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  readBy: { type: [String], default: [] }
}));

const AlertSound = mongoose.models.AlertSound || mongoose.model('AlertSound', new mongoose.Schema({
  key: { type: String, default: 'global_alert_sound', unique: true },
  name: { type: String, default: 'High-Pitch Emergency Siren' },
  soundUrl: { type: String, default: '/public/sounds/emergency_siren.wav' },
  playOnce: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}));

const Feed = mongoose.models.Feed || mongoose.model('Feed', new mongoose.Schema({
  id: Number,
  name: String,
  time: String,
  action: String,
  location: String,
  ip: String,
  phone: String
}));

const ActiveSession = mongoose.models.ActiveSession || mongoose.model('ActiveSession', new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  ip: String,
  location: String,
  lat: Number,
  lon: Number,
  loginTime: String
}));

async function seedDefaultUsers() {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      await User.insertMany([
        { email: 'admin@village.gov.in', role: 'Admin', password: 'admin123' },
        { email: 'sarpanch@village.gov.in', role: 'Sarpanch', password: 'sarpanch123' },
        { email: 'resident@village.gov.in', role: 'People/User', password: 'user123' }
      ]);
      console.log("Seeded default users to MongoDB.");
    }
  } catch (e) {
    console.error('Error seeding users:', e.message);
  }
}
mongoose.connection.once('open', seedDefaultUsers);

// ── Cloudinary Image Upload Setup ──────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'village_water_portal',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});
const upload = multer({ storage });

// ── IP Geolocation Helper ──────────────────────────────────────────
function getLocationFromIP(ip) {
  return new Promise((resolve) => {
    const privatePatterns = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.', '10.', '172.16.'];
    const isPrivate = privatePatterns.some(p => ip.startsWith(p));
    if (isPrivate) {
      return resolve({ city: 'Pune', region: 'Maharashtra', country: 'India', ip: ip, lat: 18.5204, lon: 73.8567 });
    }

    const url = `http://ip-api.com/json/${ip}?fields=status,city,regionName,country,lat,lon,query`;
    http.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success') {
            resolve({
              city: parsed.city || 'Unknown',
              region: parsed.regionName || '',
              country: parsed.country || '',
              ip: parsed.query || ip,
              lat: parsed.lat || 0,
              lon: parsed.lon || 0
            });
          } else {
            resolve({ city: 'Unknown', region: '', country: '', ip: ip, lat: 0, lon: 0 });
          }
        } catch (e) {
          resolve({ city: 'Unknown', region: '', country: '', ip: ip, lat: 0, lon: 0 });
        }
      });
    }).on('error', () => {
      resolve({ city: 'Unknown', region: '', country: '', ip: ip, lat: 0, lon: 0 });
    });
  });
}

function formatLocationString(loc) {
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.join(', ') || 'Unknown Location';
}

function requireAuth(allowedRoles) {
  return async (req, res, next) => {
    // If session lost in serverless cold start, try restoring from x-user-email header
    if (!req.session.user && req.headers['x-user-email']) {
      try {
        const decodedEmail = decodeURIComponent(req.headers['x-user-email']).toLowerCase().trim();
        const user = await User.findOne({ email: decodedEmail });
        if (user) {
          req.session.user = {
            email: user.email,
            name: user.email.split('@')[0],
            role: user.role,
            ip: req.ip || '127.0.0.1',
            location: 'Saved Device',
            loginTime: new Date().toISOString()
          };
        }
      } catch(e) {}
    }

    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (allowedRoles && !allowedRoles.includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ── Authentication Routes ──────────────────────────────────────────

app.post('/api/auth/manual', async (req, res) => {
  const { email, password, lat, lon } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Access Denied', message: 'Invalid email or password.' });
  }

  const clientIP = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  let locationStr = 'Unknown Location';
  let finalLat = 0;
  let finalLon = 0;

  if (lat && lon) {
    finalLat = parseFloat(lat);
    finalLon = parseFloat(lon);
    locationStr = `GPS: ${finalLat.toFixed(4)}, ${finalLon.toFixed(4)}`;
  } else {
    const location = await getLocationFromIP(clientIP);
    locationStr = formatLocationString(location);
    finalLat = location.lat;
    finalLon = location.lon;
  }

  req.session.user = {
    email: user.email,
    name: user.email.split('@')[0],
    role: user.role,
    ip: clientIP,
    location: locationStr,
    loginTime: new Date().toISOString()
  };

  await ActiveSession.findOneAndDelete({ email: user.email });
  await ActiveSession.create({ ...req.session.user, lat: finalLat, lon: finalLon });
  
  await Feed.create({
    id: Date.now(),
    name: req.session.user.name,
    time: req.session.user.loginTime,
    action: `Logged in manually as ${user.role}.`,
    location: locationStr,
    ip: clientIP,
    phone: 'N/A'
  });

  res.json({ success: true, user: req.session.user });
});

app.post('/api/auth/google', async (req, res) => {
  const { token, email: rawEmail, lat, lon } = req.body;

  let email, name;

  if (token) {
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      email = payload.email.toLowerCase();
      name = payload.name || email.split('@')[0];
    } catch (err) {
      if (rawEmail) {
        email = rawEmail.toLowerCase().trim();
        name = email.split('@')[0];
      } else {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
    }
  } else if (rawEmail) {
    email = rawEmail.toLowerCase().trim();
    name = email.split('@')[0];
  } else {
    return res.status(400).json({ error: 'Google token or email required' });
  }

  let user = await User.findOne({ email });
  if (!user) {
    // Auto-create new resident user on first Google sign-in
    user = await User.create({
      email: email,
      role: 'People/User',
      password: 'google_oauth_user'
    });
  }

  const clientIP = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  let locationStr = 'Unknown Location';
  let finalLat = 0;
  let finalLon = 0;

  if (lat && lon) {
    finalLat = parseFloat(lat);
    finalLon = parseFloat(lon);
    locationStr = `GPS: ${finalLat.toFixed(4)}, ${finalLon.toFixed(4)}`;
  } else {
    const location = await getLocationFromIP(clientIP);
    locationStr = formatLocationString(location);
    finalLat = location.lat;
    finalLon = location.lon;
  }

  req.session.user = { email, name, role: user.role, ip: clientIP, location: locationStr, loginTime: new Date().toISOString() };
  
  await ActiveSession.findOneAndDelete({ email });
  await ActiveSession.create({ ...req.session.user, lat: finalLat, lon: finalLon });

  await Feed.create({
    id: Date.now(),
    name: name,
    time: req.session.user.loginTime,
    action: `Logged in via Google as ${user.role}.`,
    location: locationStr,
    ip: clientIP,
    phone: 'N/A'
  });

  res.json({ success: true, user: req.session.user });
});

app.get('/api/auth/status', async (req, res) => {
  if (!req.session.user && req.headers['x-user-email']) {
    try {
      const decodedEmail = decodeURIComponent(req.headers['x-user-email']).toLowerCase().trim();
      const user = await User.findOne({ email: decodedEmail });
      if (user) {
        req.session.user = {
          email: user.email,
          name: user.email.split('@')[0],
          role: user.role,
          ip: req.ip || '127.0.0.1',
          location: 'Saved Device',
          loginTime: new Date().toISOString()
        };
      }
    } catch(e) {}
  }

  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (req.session.user) {
    await ActiveSession.findOneAndDelete({ email: req.session.user.email });
    await Feed.create({
      id: Date.now(),
      name: req.session.user.name,
      time: new Date().toISOString(),
      action: `Logged out.`,
      location: req.session.user.location,
      ip: req.session.user.ip,
      phone: 'N/A'
    });
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// ── Notifications APIs ──────────────────────────────────────────────

// Fetch notifications for current user
app.get('/api/notifications', async (req, res) => {
  const userEmail = req.session.user?.email || '';
  const userRole = req.session.user?.role || 'People/User';

  const query = {
    $or: [
      { targetRole: 'all' },
      { targetRole: userRole },
      { targetEmail: userEmail }
    ]
  };

  const notifs = await Notification.find(query).sort({ createdAt: -1 }).limit(30);
  const mapped = notifs.map(n => {
    const obj = n.toObject();
    obj.isRead = userEmail ? (obj.readBy || []).includes(userEmail) : false;
    return obj;
  });

  const unreadCount = mapped.filter(n => !n.isRead).length;
  res.json({ unreadCount, notifications: mapped });
});

// Get Global Alert Sound Setting
app.get('/api/alert-sound', async (req, res) => {
  let sound = await AlertSound.findOne({ key: 'global_alert_sound' });
  if (!sound) {
    sound = await AlertSound.create({
      key: 'global_alert_sound',
      name: 'High-Pitch Emergency Siren',
      soundUrl: '/public/sounds/emergency_siren.wav',
      playOnce: true
    });
  }
  res.json(sound);
});

// Admin / Sarpanch Upload Custom Alert Sound
app.post('/api/admin/alert-sound', requireAuth(['Admin', 'Sarpanch']), upload.single('sound'), async (req, res) => {
  const { name, soundUrl, playOnce } = req.body;
  let finalSoundUrl = req.file ? req.file.path : soundUrl;

  if (!finalSoundUrl) {
    return res.status(400).json({ error: 'Audio file or soundUrl is required' });
  }

  const sound = await AlertSound.findOneAndUpdate(
    { key: 'global_alert_sound' },
    {
      name: name || (req.file ? req.file.originalname : 'Custom Uploaded Sound'),
      soundUrl: finalSoundUrl,
      playOnce: playOnce !== undefined ? (playOnce === 'true' || playOnce === true) : true,
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Feed.create({
    id: Date.now(),
    name: req.session.user?.name || req.session.user?.email || 'Admin',
    time: new Date().toISOString(),
    action: `Updated Custom Alert Sound Pack: "${sound.name}" (Play Once: ${sound.playOnce})`,
    location: req.session.user?.location || 'Panchayat Office',
    ip: req.ip || '127.0.0.1',
    phone: 'N/A'
  });

  res.json({ success: true, sound });
});

// Sarpanch / Admin can create custom notifications
app.post('/api/notifications', requireAuth(['Admin', 'Sarpanch']), upload.single('sound'), async (req, res) => {
  const { title, message, targetRole, isEmergency, soundUrl, playOnce } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  let finalSoundUrl = req.file ? req.file.path : (soundUrl || null);
  let shouldPlayOnce = playOnce !== undefined ? (playOnce === 'true' || playOnce === true) : true;

  if (!finalSoundUrl && isEmergency) {
    const globalSound = await AlertSound.findOne({ key: 'global_alert_sound' });
    if (globalSound && globalSound.soundUrl) {
      finalSoundUrl = globalSound.soundUrl;
      shouldPlayOnce = globalSound.playOnce !== false;
    }
  }

  const newNotif = await Notification.create({
    id: Date.now(),
    title: title.trim(),
    message: message.trim(),
    senderName: req.session.user?.name || req.session.user?.email || 'Sarpanch Office',
    senderRole: req.session.user?.role || 'Sarpanch',
    targetRole: targetRole || 'all',
    type: isEmergency ? 'alert' : 'broadcast',
    isEmergency: Boolean(isEmergency),
    soundUrl: finalSoundUrl,
    playOnce: shouldPlayOnce, // Plays 1 time and stops!
    createdAt: new Date(),
    readBy: [req.session.user?.email]
  });

  await Feed.create({
    id: Date.now(),
    name: req.session.user?.name || 'Sarpanch',
    time: new Date().toISOString(),
    action: `${isEmergency ? '🚨 EMERGENCY SIREN ALERT' : 'Sent village notification'}: "${title}"`,
    location: req.session.user?.location || 'Panchayat Bhavan',
    ip: req.session.user?.ip || '::1',
    phone: 'N/A'
  });

  res.json({ success: true, notification: newNotif });
});

// Mark notifications read
app.put('/api/notifications/read-all', requireAuth(), async (req, res) => {
  const userEmail = req.session.user.email;
  await Notification.updateMany(
    { readBy: { $ne: userEmail } },
    { $addToSet: { readBy: userEmail } }
  );
  res.json({ success: true });
});

// ── Admin Routes ────────────────────────────────────────────
app.get('/api/admin/feed', requireAuth(['Admin']), async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeSessions = await ActiveSession.countDocuments();
  const activeReports = await Issue.countDocuments({ status: { $ne: 'Resolved' } });
  const feed = await Feed.find({}, { _id: 0, __v: 0 }).sort({ id: -1 }).limit(50);
  res.json({ totalUsers, activeSessions, activeReports, feed });
});

app.delete('/api/admin/feed', requireAuth(['Admin']), async (req, res) => {
  await Feed.deleteMany({});
  res.json({ success: true });
});

app.get('/api/admin/users', requireAuth(['Admin']), async (req, res) => {
  const users = await User.find({}, { _id: 0, __v: 0 });
  res.json(users);
});

app.put('/api/admin/users/:email/password', requireAuth(['Admin']), async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });
  
  const user = await User.findOneAndUpdate(
    { email: req.params.email.toLowerCase() },
    { password: password },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

app.put('/api/admin/users/:email/role', requireAuth(['Admin']), async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });
  
  const user = await User.findOneAndUpdate(
    { email: req.params.email.toLowerCase() },
    { role: role },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

app.get('/api/admin/roles', requireAuth(['Admin']), async (req, res) => {
  const users = await User.find();
  const rolesObj = {};
  users.forEach(u => rolesObj[u.email] = u.role);
  res.json(rolesObj);
});

app.post('/api/admin/roles', requireAuth(['Admin']), async (req, res) => {
  const { email, role, password } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Email and role required' });
  
  const updateData = { role: role };
  if (password) updateData.password = password;

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, user });
});

app.delete('/api/admin/roles', requireAuth(['Admin']), async (req, res) => {
  const { email } = req.body;
  await User.findOneAndDelete({ email: email.toLowerCase() });
  await ActiveSession.findOneAndDelete({ email: email.toLowerCase() });
  res.json({ success: true });
});

app.get('/api/admin/sessions', requireAuth(['Admin', 'Sarpanch']), async (req, res) => {
  const sessions = await ActiveSession.find({}, { _id: 0, __v: 0 });
  res.json(sessions);
});

app.delete('/api/admin/sessions', requireAuth(['Admin']), async (req, res) => {
  const { email } = req.body;
  await ActiveSession.findOneAndDelete({ email: email.toLowerCase() });
  res.json({ success: true });
});

// ── Issues API ─────────────────────────────────────────────────────
app.get('/api/issues', async (req, res) => {
  const issues = await Issue.find({}, { _id: 0, __v: 0 }).sort({ createdAt: -1 });
  res.json(issues);
});

app.post('/api/issues', requireAuth(), upload.single('photo'), async (req, res) => {
  const { title, type, description, location, gps } = req.body;
  
  let finalLat = 0, finalLon = 0;
  if (gps && gps !== 'Unknown') {
    const parts = gps.split(',');
    if (parts.length === 2) {
      finalLat = parseFloat(parts[0].trim());
      finalLon = parseFloat(parts[1].trim());
    }
  }

  const newIssue = new Issue({
    id: Date.now(),
    title,
    type,
    description,
    location,
    lat: finalLat,
    lon: finalLon,
    photoUrl: req.file ? req.file.path : null,
    reporter: req.session.user.name || req.session.user.email,
    reporterEmail: req.session.user.email,
    status: 'Pending'
  });
  await newIssue.save();

  // 1. Send instant in-app notification to the reporting User
  await Notification.create({
    id: Date.now() + 1,
    title: `Report Submitted: ${title}`,
    message: `Your issue at "${location}" has been received. Panchayat team will inspect and take action soon.`,
    senderName: 'Gram Jal Portal',
    senderRole: 'System',
    targetEmail: req.session.user.email,
    targetRole: 'People/User',
    type: 'issue',
    createdAt: new Date(),
    readBy: []
  });

  // 2. Send instant in-app notification to Sarpanch and Admin
  await Notification.create({
    id: Date.now() + 2,
    title: `New Issue: ${title}`,
    message: `Reported by ${req.session.user.name} at ${location}: "${description}"`,
    senderName: req.session.user.name,
    senderRole: req.session.user.role,
    targetRole: 'Sarpanch',
    type: 'issue',
    createdAt: new Date(),
    readBy: []
  });

  await Feed.create({
    id: Date.now(),
    name: req.session.user.name,
    time: new Date().toISOString(),
    action: `Reported issue: ${title}`,
    location: req.session.user.location,
    ip: req.session.user.ip,
    phone: 'N/A'
  });

  res.json({ success: true, issue: newIssue });
});

app.delete('/api/issues/:id', requireAuth(['Admin']), async (req, res) => {
  const issueId = parseInt(req.params.id, 10);
  await Issue.findOneAndDelete({ id: issueId });
  res.json({ success: true });
});

app.put('/api/issues/:id/resolve', upload.single('photo'), async (req, res) => {
  const issueId = parseInt(req.params.id, 10);
  const existing = await Issue.findOne({ id: issueId });
  if (!existing) return res.status(404).json({ error: 'Issue not found' });

  const userEmail = req.session?.user?.email || (req.headers['x-user-email'] ? decodeURIComponent(req.headers['x-user-email']) : null) || 'Sarpanch Office';
  const userRole = req.session?.user?.role || 'Gram Panchayat';

  const resolutionPhoto = req.file ? req.file.path : (existing.photoUrl || 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&q=80&w=600');

  const updated = await Issue.findOneAndUpdate(
    { id: issueId },
    { 
      status: 'Resolved',
      resolvedBy: userEmail,
      resolvedAt: new Date(),
      resolutionPhotoUrl: resolutionPhoto
    },
    { new: true }
  );

  if (!updated) return res.status(404).json({ error: 'Issue not found' });

  // Send resolved notification to village
  try {
    await Notification.create({
      id: Date.now(),
      title: `Issue Resolved: ${updated.title}`,
      message: `Issue at ${updated.location} was resolved by ${userRole} (${userEmail}).`,
      senderName: req.session?.user?.name || userEmail,
      senderRole: userRole,
      targetRole: 'all',
      type: 'issue',
      createdAt: new Date(),
      readBy: []
    });

    await Feed.create({
      id: Date.now(),
      name: req.session?.user?.name || userEmail,
      time: new Date().toISOString(),
      action: `Resolved issue #${issueId}: "${updated.title}"`,
      location: updated.location || 'Panchayat Office',
      ip: req.ip || '127.0.0.1',
      phone: 'N/A'
    });
  } catch (err) {
    console.error("Resolve feed/notification error:", err);
  }

  res.json({ success: true, issue: updated });
});

// HTML Pages Setup
const pages = {
  '/login': 'login_demo_role_detection',
  '/home': 'village_progress_home',
  '/report': 'report_an_issue',
  '/admin': 'admin_live_user_tracking',
  '/tasks': 'sarpanch_task_verification',
  '/support': 'contact_support'
};

Object.entries(pages).forEach(([route, folder]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, folder, 'code.html'));
  });
});

// Mobile App Route (Same original design system)
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/', (req, res) => res.redirect('/login'));

// Start the server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Self-ping to prevent sleep
const cron = require('node-cron');
const https = require('https');
cron.schedule('*/1 * * * *', () => {
  const baseUrl = process.env.SERVER_URL ? process.env.SERVER_URL.replace(/\/$/, '') : `http://localhost:${PORT}`;
  const url = `${baseUrl}/api/auth/status`;
  const getModule = url.startsWith('https') ? https : http;
  
  getModule.get(url, (res) => {
    res.resume();
  }).on('error', () => {});
});

module.exports = app;
