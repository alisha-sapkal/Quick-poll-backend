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

// Allow dev clients from any origin (or configure via CLIENT_ORIGIN)
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().toLowerCase().replace(/\/$/, ''))
  .filter(Boolean);

const corsConfig = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const o = origin.toLowerCase().replace(/\/$/, '');
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(o)) return callback(null, true);
    // Allow Vercel preview domains by default
    if (o.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error(`CORS blocked from origin: ${origin}`));
  },
methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true,
};

app.use(cors(corsConfig));
app.options('*', cors(corsConfig));
app.set('trust proxy', true);
app.use(express.json());

app.get('/api/health', (req, res) => {
  // db: 1=connected, 2=connecting, 0=disconnected, 3=disconnecting
  const dbReady = mongoose.connection.readyState === 1;
  res.json({ ok: true, db: dbReady ? 'up' : 'down' });
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

function connectWithRetry() {
  const isSrv = MONGO_URI.startsWith('mongodb+srv://');
  const connectOptions = {
    serverSelectionTimeoutMS: 7000,
    ...(isSrv ? {} : { dbName: 'quickpoll' })
  };
  mongoose.connect(MONGO_URI, connectOptions)
    .then(() => {
      console.log('MongoDB connected');
    })
    .catch((err) => {
      const redacted = MONGO_URI.replace(/(:)([^@/]+)(@)/, '$1****$3');
      console.error('MongoDB connection failed');
      console.error('Mongo URI:', redacted);
      console.error('Error:', err?.message || err);
      if (MONGO_URI.startsWith('mongodb+srv://')) {
        console.error('Tip: For MongoDB Atlas, ensure your deploy IP is allowlisted or set 0.0.0.0/0 during testing, and that the connection string/user credentials are valid.');
      }
      setTimeout(connectWithRetry, 5000);
    });
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
connectWithRetry();
