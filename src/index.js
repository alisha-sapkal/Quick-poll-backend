import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import pollsRouter from './routes/polls.js';

dotenv.config();

const app = express();
// SSE clients and broadcaster
app.locals.sseClients = new Set();
app.locals.broadcast = function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of app.locals.sseClients) {
    try { res.write(payload); } catch { /* ignore write errors */ }
  }
};

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// SSE stream endpoint
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Add client
  app.locals.sseClients.add(res);

  // initial event
  res.write(`event: connected\ndata: {"ok":true}\n\n`);

  // heartbeat
  const hb = setInterval(() => {
    try { res.write(`:keep-alive\n\n`); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    app.locals.sseClients.delete(res);
    try { res.end(); } catch {}
  });
});

app.use('/api/polls', pollsRouter);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quickpoll';
const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'quickpoll' });
    console.log('MongoDB connected');

    app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
