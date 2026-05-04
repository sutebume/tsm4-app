const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tsm4.db');
let db;

function getDB() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'engineer',
      name TEXT NOT NULL,
      engineer_id INTEGER DEFAULT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS engineers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engineer_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      activity TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 0,
      wbs TEXT NOT NULL DEFAULT 'no',
      FOREIGN KEY (engineer_id) REFERENCES engineers(id)
    );

    CREATE TABLE IF NOT EXISTS workday_hours (
      date TEXT PRIMARY KEY,
      hours REAL NOT NULL DEFAULT 8
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrations — safe to run every time, ignored if column already exists
  const migrations = [
    `ALTER TABLE users ADD COLUMN engineer_id INTEGER DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN telegram_id TEXT DEFAULT NULL`,
    `ALTER TABLE entries ADD COLUMN ot TEXT NOT NULL DEFAULT 'no'`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (e) { /* already exists */ }
  }

  // Seed default admin/manager if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    db.prepare('INSERT INTO users (username, password, role, name, must_change_password) VALUES (?, ?, ?, ?, 0)')
      .run('admin', bcrypt.hashSync('admin123', 10), 'admin', 'Admin');
    db.prepare('INSERT INTO users (username, password, role, name, must_change_password) VALUES (?, ?, ?, ?, 0)')
      .run('manager', bcrypt.hashSync('manager123', 10), 'manager', 'Manager');
  }

  // Seed default engineers if none exist
  const engCount = db.prepare('SELECT COUNT(*) as c FROM engineers').get();
  if (engCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const names = ['Engineer 1', 'Engineer 2', 'Engineer 3', 'Engineer 4', 'Engineer 5'];
    names.forEach((name, i) => {
      const result = db.prepare('INSERT INTO engineers (name, sort_order) VALUES (?, ?)').run(name, i);
      const engId = result.lastInsertRowid;
      const username = `engineer${i + 1}`;
      const password = bcrypt.hashSync(`engineer${i + 1}123`, 10);
      // must_change_password = 1 for all seeded engineers
      db.prepare('INSERT INTO users (username, password, role, name, engineer_id, must_change_password) VALUES (?, ?, ?, ?, ?, 1)')
        .run(username, password, 'engineer', name, engId);
    });
    console.log('Seeded 5 engineers (must change password on first login)');
  }

  console.log('Database initialized');
}

module.exports = { getDB, initDB };
