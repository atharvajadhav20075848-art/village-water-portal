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

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);

app.use(session({
  secret: 'gram-panchayat-water-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Database Setup (MongoDB) ───────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Live Database!'))
  .catch(err => {
    console.error('Failed to connect to MongoDB. Have you added the connection string to .env?');
    console.error(err);
  });

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: 'People/User' }
}));

const Issue = mongoose.model('Issue', new mongoose.Schema({
  id: { type: Number, required: true },
  title: String,
  type: String,
  description: String,
  location: String,
  lat: Number,
  lon: Number,
  photoUrl: String,
  status: { type: String, default: 'Pending' },
  resolvedBy: String,
  resolutionPhotoUrl: String,
  createdAt: { type: Date, default: Date.now }
}));

const Feed = mongoose.model('Feed', new mongoose.Schema({
  id: Number,
  name: String,
  time: String,
  action: String,
  location: String,
  ip: String,
  phone: String
}));

const ActiveSession = mongoose.model('ActiveSession', new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  ip: String,
  location: String,
  lat: Number,
  lon: Number,
  loginTime: String
}));

// Function to seed default users if db is empty
async function seedDefaultUsers() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.insertMany([
      { email: 'admin@village.gov.in', role: 'Admin', password: 'admin123' },
      { email: 'sarpanch@village.gov.in', role: 'Sarpanch', password: 'sarpanch123' },
      { email: 'resident@village.gov.in', role: 'People/User', password: 'user123' }
    ]);
    console.log("Seeded default users to MongoDB.");
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

// ── Authentication Routes ──────────────────────────────────────────

app.post('/api/auth/manual', async (req, res) => {
  const { email, password, lat, lon } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Access Denied', message: 'Invalid email or password.' });
  }

  const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
  let locationStr = 'Unknown Location';
  let finalLat = 0;
  let finalLon = 0;

  if (lat && lon) {
    finalLat = lat;
    finalLon = lon;
    locationStr = `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
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
  const { token, lat, lon } = req.body;
  if (!token) return res.status(400).json({ error: 'Google token required' });

  let email, name;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    email = payload.email.toLowerCase();
    name = payload.name;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(403).json({ error: 'Access Denied', message: 'Email not authorized.' });
  }

  const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
  let locationStr = 'Unknown Location';
  let finalLat = 0;
  let finalLon = 0;

  if (lat && lon) {
    finalLat = lat;
    finalLon = lon;
    locationStr = `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
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

app.get('/api/auth/status', (req, res) => {
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

function requireAuth(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (allowedRoles && !allowedRoles.includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ── Admin Routes ────────────────────────────────────────────
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
  res.json({ success: true });
});

app.get('/api/admin/roles', requireAuth(['Admin']), async (req, res) => {
  const users = await User.find();
  const rolesObj = {};
  users.forEach(u => rolesObj[u.email] = u.role);
  res.json(rolesObj);
});

app.post('/api/admin/roles', requireAuth(['Admin']), async (req, res) => {
  const { email, role } = req.body;
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role: role },
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
  const feedItems = await Feed.find({}, { _id: 0, __v: 0 }).sort({ id: -1 }).limit(50);
  res.json({ sessions, feed: feedItems });
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
    photoUrl: req.file ? req.file.path : null, // Cloudinary provides secure URL in req.file.path
    status: 'Pending'
  });
  await newIssue.save();

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

app.put('/api/issues/:id/resolve', requireAuth(['Admin', 'Sarpanch']), upload.single('photo'), async (req, res) => {
  const issueId = parseInt(req.params.id, 10);
  
  const updated = await Issue.findOneAndUpdate(
    { id: issueId },
    { 
      status: 'Resolved',
      resolvedBy: req.session.user.email,
      resolutionPhotoUrl: req.file ? req.file.path : null
    },
    { new: true }
  );

  if (!updated) return res.status(404).json({ error: 'Issue not found' });

  await Feed.create({
    id: Date.now(),
    name: req.session.user.name,
    time: new Date().toISOString(),
    action: `Resolved issue #${issueId}`,
    location: req.session.user.location,
    ip: req.session.user.ip,
    phone: 'N/A'
  });

  res.json({ success: true, issue: updated });
});

// HTML Pages Setup (Direct serving logic so they can view it from localhost:3000)
const pages = {
  '/login': 'login_demo_role_detection',
  '/home': 'village_progress_home',
  '/report': 'report_an_issue',
  '/admin': 'admin_live_user_tracking',
  '/tasks': 'sarpanch_task_verification',
  '/support': 'support'
};

Object.entries(pages).forEach(([route, folder]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, folder, 'code.html'));
  });
});
app.get('/', (req, res) => res.redirect('/login'));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
