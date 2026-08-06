const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function readJSON(name) {
  const p = path.join(DB_DIR, name + '.json');
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(name, data) {
  const p = path.join(DB_DIR, name + '.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

module.exports = {
  loadMessages: () => readJSON('messages'),
  saveMessage: (msg) => {
    const list = readJSON('messages');
    list.push(msg);
    writeJSON('messages', list);
  },
  clearMessages: () => writeJSON('messages', []),
  loadUsers: () => readJSON('users'),
  saveUser: (u) => {
    const list = readJSON('users');
    list.push(u);
    writeJSON('users', list);
  },
};
