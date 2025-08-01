const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Put the DB file in a cross‑platform writable location
const { app } = require('electron');
const userDataPath = app.getPath('userData');
const dbFile = path.join(userDataPath, 'app.sqlite');

const db = new sqlite3.Database(dbFile, err => {
  if (err) console.error('Failed to open DB:', err);
  else console.log('SQLite DB opened at', dbFile);
});

// Run each migration in order
const migrationsDir = path.join(__dirname, 'migrations');
fs.readdirSync(migrationsDir)
  .filter(f => f.match(/^\d+.*\.js$/))
  .sort()
  .forEach(file => {
    const migration = require(path.join(migrationsDir, file));
    if (typeof migration.up === 'function') {
      console.log('Running migration', file);
      migration.up(db);
    }
  });

module.exports = db;