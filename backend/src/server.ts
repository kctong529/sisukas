// src/server.js
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import pool from './config/database';
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import usersRoutes from './routes/users';
import favouritesRoutes from './routes/favourites';
import { extractSession } from './middleware/auth';
import { exchangeCodes } from './db/schema';
import { db } from './db';
import { eq, and } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.all('/api/auth/{*any}', toNodeHandler(auth));

app.get("/api/auth/magic-link/verify", async (req, res) => {
  // Ensure token and callbackURL are strings
  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const callbackURL = Array.isArray(req.query.callbackURL) ? req.query.callbackURL[0] : req.query.callbackURL;

  if (!token) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);

  try {
    // Verify the magic link — this creates a session cookie
    const result = await auth.api.magicLinkVerify({
      query: { token: token as string },
      headers: req.headers as any,
    });

    if (!result?.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }

    // Create a short-lived exchange code for frontend to finalize session
    const code = crypto.randomUUID();
    await db.insert(exchangeCodes).values({
      code,
      userId: result.user.id,
      email: result.user.email,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Redirect frontend to callback page with code
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?code=${code}`);
  } catch (err) {
    console.error("Magic link verification failed:", err);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
});

app.post("/api/auth/exchange-code", express.json(), async (req, res) => {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "No code provided" });

  const rows = await db.select().from(exchangeCodes).where(eq(exchangeCodes.code, code)).execute();

  if (!rows.length) return res.status(400).json({ error: "Invalid or expired code" });

  const userId = rows[0].userId;
  const email = rows[0].email; // if your schema doesn’t have email, use auth db lookup

  try {
    // Sign in via better-auth — this sets the session cookie
    await auth.api.signInMagicLink({
      body: { email },  // email must exist in your auth DB
      headers: req.headers as any,
    });

    // Optionally delete the code so it can't be reused
    await db.delete(exchangeCodes).where(eq(exchangeCodes.code, code)).execute();

    res.json({ ok: true });
  } catch (err) {
    console.error('Error signing in:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Sisukas backend!' });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.use('/api/users', usersRoutes);
app.use(extractSession);
app.use('/api/favourites', favouritesRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on ${process.env.BACKEND_URL}`);
  console.log(`CORS allows requests from ${process.env.FRONTEND_URL}`);
});