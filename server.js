import express from 'express';
import { WebSocketServer } from 'ws';
import db from './server/db.js';

const httpPort = 4000;
const wsPort = 4001;

const app = express();
app.use(express.json());

function hashPassword(password) {
  return `hash:${password}`;
}

function createError(message) {
  return { success: false, message };
}

app.post('/api/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json(createError('Заполните все поля'));
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users (email, password, name, created_at) VALUES (?, ?, ?, ?)`,
    [email, hashPassword(password), name, now],
    function (err) {
      if (err) {
        return res.status(400).json(createError('Пользователь уже существует'));
      }
      res.json({ success: true, user: { id: this.lastID, email, name } });
    },
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json(createError('Заполните все поля'));
  }
  db.get(`SELECT id, email, name, password FROM users WHERE email = ?`, [email], (err, row) => {
    if (err || !row || row.password !== hashPassword(password)) {
      return res.status(401).json(createError('Неверный логин или пароль'));
    }
    res.json({ success: true, user: { id: row.id, email: row.email, name: row.name } });
  });
});

const httpServer = app.listen(httpPort, () => {
  console.log(`TeleMAX API запущен на http://127.0.0.1:${httpPort}`);
});

const wss = new WebSocketServer({ port: wsPort });

function broadcast(data, sender) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && client !== sender) {
      client.send(message);
    }
  }
}

wss.on('connection', (socket) => {
  console.log('Клиент подключился к WebSocket-серверу.');

  db.all(`SELECT * FROM messages ORDER BY id ASC LIMIT 100`, (err, rows) => {
    if (!err && rows) {
      socket.send(JSON.stringify({ type: 'history', data: rows }));
    }
  });

  socket.send(JSON.stringify({ author: 'TeleMAX', text: 'Добро пожаловать в чат TeleMAX!', type: 'system' }));

  socket.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'typing') {
        broadcast(data, socket);
        return;
      }

      const outgoing = {
        author: data.author || 'Аноним',
        text: data.text || '',
        type: 'in',
        image: data.image || null,
        sticker: data.sticker || null,
        replyTo: data.replyTo || null,
        reactions: JSON.stringify(data.reactions || {}),
        edited: data.edited ? 1 : 0,
        created_at: new Date().toISOString(),
      };

      db.run(
        `INSERT INTO messages (chat_name, author, text, type, image, sticker, replyTo, reactions, edited, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.chatName || 'Главный чат', outgoing.author, outgoing.text, outgoing.type, outgoing.image, outgoing.sticker, outgoing.replyTo, outgoing.reactions, outgoing.edited, outgoing.created_at],
      );

      broadcast({ ...outgoing, type: 'in' }, socket);
    } catch (error) {
      socket.send(JSON.stringify({ author: 'TeleMAX', text: 'Ошибка формата сообщения.', type: 'system' }));
    }
  });

  socket.on('close', () => {
    console.log('Клиент отключился от WebSocket-серверa.');
  });
});

console.log(`TeleMAX WebSocket server запущен на ws://127.0.0.1:${wsPort}`);
