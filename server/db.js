import Database from 'better-sqlite3';

export function initDB(path) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_group INTEGER DEFAULT 0,
      title TEXT,
      last_message_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS chat_participants (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(chat_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT,
      file_url TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      edited_at DATETIME,
      deleted INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chat_reads (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chat_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji)
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    );
  `);
  // Ensure global chat
  const global = db.prepare('SELECT id FROM chats WHERE id = 1').get();
  if (!global) {
    db.prepare('INSERT INTO chats (id, is_group, title, last_message_at) VALUES (1, 1, ?, CURRENT_TIMESTAMP)').run('Global');
  }
  return db;
}
