import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'telemax.sqlite');
if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size === 0) {
  fs.unlinkSync(DB_PATH);
}

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('SQLite open error', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_name TEXT NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    image TEXT,
    sticker TEXT,
    replyTo TEXT,
    reactions TEXT,
    edited INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
});

export default db;
