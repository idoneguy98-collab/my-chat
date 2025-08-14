import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { initDB } from './db.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const DATABASE_URL = process.env.DATABASE_URL || './data.sqlite';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:you@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/stickers', express.static(path.join(__dirname, 'public', 'stickers')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN, methods: ['GET','POST'] } });

const db = initDB(DATABASE_URL);

// Multer for attachments & avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9_\.\-]/g, '_');
    cb(null, ts + '_' + safe);
  }
});
const upload = multer({ storage });

// Helpers
function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username, avatar_url: user.avatar_url || null }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function touchChat(chatId) {
  db.prepare('UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(chatId);
}

// Presence
const onlineUsers = new Map(); // userId -> Set(socketId)

// Auth
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    const user = { id: info.lastInsertRowid, username };
    const token = createToken(user);
    res.json({ token, user });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createToken(user);
  res.json({ token, user: { id: user.id, username: user.username, avatar_url: user.avatar_url } });
});

// Profile
app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  const url = `${PUBLIC_URL}/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user.id);
  const user = db.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Push: public key + subscribe
app.get('/api/push/publicKey', (req, res) => res.json({ key: VAPID_PUBLIC_KEY }));
app.post('/api/push/subscribe', authMiddleware, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
  db.prepare(`INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
              VALUES (?, ?, ?, ?)`)
    .run(req.user.id, endpoint, keys.p256dh, keys.auth);
  res.json({ ok: true });
});

// Chats
app.get('/api/chats', authMiddleware, (req, res) => {
  const chats = db.prepare(`
    SELECT c.id, c.is_group, c.title, c.last_message_at,
      (SELECT content FROM messages m WHERE m.chat_id = c.id AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1) AS last_message,
      (SELECT type FROM messages m WHERE m.chat_id = c.id AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1) AS last_type,
      IFNULL((SELECT COUNT(1) FROM messages m
              LEFT JOIN chat_reads r ON r.chat_id = m.chat_id AND r.user_id = ?
              WHERE m.chat_id = c.id
                AND m.deleted = 0
                AND (r.last_read_message_id IS NULL OR m.id > r.last_read_message_id)), 0) AS unread_count
    FROM chats c
    JOIN chat_participants p ON p.chat_id = c.id
    WHERE p.user_id = ? OR c.id = 1
    GROUP BY c.id
    ORDER BY c.last_message_at DESC NULLS LAST
  `).all(req.user.id, req.user.id);
  res.json(chats);
});
app.post('/api/chats/dm', authMiddleware, (req, res) => {
  const { peerId } = req.body;
  // find or create
  const rows = db.prepare(`
    SELECT c.id FROM chats c
    JOIN chat_participants p1 ON p1.chat_id = c.id AND p1.user_id = ?
    JOIN chat_participants p2 ON p2.chat_id = c.id AND p2.user_id = ?
    WHERE c.is_group = 0
  `).all(req.user.id, Number(peerId));
  let chatId;
  if (rows.length) chatId = rows[0].id;
  else {
    const info = db.prepare('INSERT INTO chats (is_group, title, last_message_at) VALUES (0, NULL, CURRENT_TIMESTAMP)').run();
    chatId = info.lastInsertRowid;
    db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)')
      .run(chatId, req.user.id, chatId, Number(peerId));
  }
  res.json({ chatId });
});
app.post('/api/chats/read', authMiddleware, (req, res) => {
  const { chatId, lastMessageId } = req.body;
  if (!chatId || !lastMessageId) return res.status(400).json({ error: 'chatId & lastMessageId required' });
  db.prepare(`INSERT INTO chat_reads (chat_id, user_id, last_read_message_id)
              VALUES (?, ?, ?)
              ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id, updated_at = CURRENT_TIMESTAMP`)
    .run(Number(chatId), req.user.id, Number(lastMessageId));
  // notify receipts
  io.to('chat:'+chatId).emit('read', { chatId: Number(chatId), userId: req.user.id, lastMessageId: Number(lastMessageId) });
  res.json({ ok: true });
});

// Users
app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, avatar_url, last_seen FROM users ORDER BY username ASC').all();
  res.json(users);
});

// Messages
app.get('/api/messages', authMiddleware, (req, res) => {
  const { chatId } = req.query;
  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  const rows = db.prepare(`
    SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ? AND m.deleted = 0
    ORDER BY m.id ASC
    LIMIT 1000
  `).all(Number(chatId));
  res.json(rows);
});
app.post('/api/messages', authMiddleware, (req, res) => {
  const { chatId, content, type = 'text' } = req.body;
  if (!chatId || !content) return res.status(400).json({ error: 'chatId & content required' });
  const info = db.prepare('INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, ?, ?)')
    .run(Number(chatId), req.user.id, type, content);
  touchChat(chatId);
  const msg = db.prepare(`
    SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(info.lastInsertRowid);
  io.to('chat:'+chatId).emit('message', msg);
  // Push to other participants
  pushToChatParticipants(Number(chatId), req.user.id, msg);
  res.json(msg);
});
app.post('/api/messages/upload', authMiddleware, upload.single('file'), (req, res) => {
  const { chatId } = req.body;
  if (!chatId || !req.file) return res.status(400).json({ error: 'chatId & file required' });
  const url = `${PUBLIC_URL}/uploads/${req.file.filename}`;
  const fileType = (req.file.mimetype || '').startsWith('image/') ? 'image' : 'file';
  const info = db.prepare('INSERT INTO messages (chat_id, sender_id, type, file_url, content) VALUES (?, ?, ?, ?, ?)')
    .run(Number(chatId), req.user.id, fileType, url, req.file.originalname);
  touchChat(chatId);
  const msg = db.prepare(`
    SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(info.lastInsertRowid);
  io.to('chat:'+chatId).emit('message', msg);
  pushToChatParticipants(Number(chatId), req.user.id, msg);
  res.json(msg);
});
app.post('/api/messages/sticker', authMiddleware, (req, res) => {
  const { chatId, url } = req.body;
  if (!chatId || !url) return res.status(400).json({ error: 'chatId & url required' });
  const info = db.prepare('INSERT INTO messages (chat_id, sender_id, type, file_url) VALUES (?, ?, ?, ?)')
    .run(Number(chatId), req.user.id, 'sticker', url);
  touchChat(chatId);
  const msg = db.prepare(`
    SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(info.lastInsertRowid);
  io.to('chat:'+chatId).emit('message', msg);
  pushToChatParticipants(Number(chatId), req.user.id, msg);
  res.json(msg);
});

// Reactions
app.post('/api/messages/react', authMiddleware, (req, res) => {
  const { messageId, emoji } = req.body;
  if (!messageId || !emoji) return res.status(400).json({ error: 'messageId & emoji required' });
  db.prepare(`INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`)
    .run(Number(messageId), req.user.id, emoji);
  const rec = { messageId: Number(messageId), userId: req.user.id, emoji };
  // Find chat of message to emit in correct room
  const row = db.prepare('SELECT chat_id FROM messages WHERE id = ?').get(Number(messageId));
  if (row) io.to('chat:'+row.chat_id).emit('reaction', rec);
  res.json({ ok: true });
});

// Stickers static list
app.get('/api/stickers', (req, res) => {
  const dir = path.join(__dirname, 'public', 'stickers');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
  res.json(files.map(f => `${PUBLIC_URL}/stickers/${f}`));
});

// Socket.IO auth & events
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try { socket.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  const uid = socket.user.id;
  if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
  onlineUsers.get(uid).add(socket.id);
  io.emit('presence', Array.from(onlineUsers.keys()));

  socket.on('join', (chatId) => socket.join('chat:'+chatId));
  socket.on('leave', (chatId) => socket.leave('chat:'+chatId));
  socket.on('typing', ({ chatId, typing }) => socket.to('chat:'+chatId).emit('typing', { chatId, userId: uid, typing }));

  socket.on('disconnect', () => {
    const set = onlineUsers.get(uid);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(uid);
        // update last seen
        db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(uid);
      }
    }
    io.emit('presence', Array.from(onlineUsers.keys()));
  });
});

// Push helper
function pushToChatParticipants(chatId, senderId, msg) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  // all participants except sender
  const participants = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?').all(chatId, senderId);
  for (const p of participants) {
    // subscriptions
    const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(p.user_id);
    for (const s of subs) {
      const pushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      const payload = JSON.stringify({
        title: msg.type === 'text' ? (msg.content.slice(0, 60) || 'New message') : `[${msg.type}]`,
        body: `from @${msg.sender_username}`,
        url: '/', // клиент откроет и сам переключится
      });
      webpush.sendNotification(pushSub, payload).catch(()=>{});
    }
  }
}

httpServer.listen(PORT, () => console.log('Server listening on :' + PORT));
