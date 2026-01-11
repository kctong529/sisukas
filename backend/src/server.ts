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
import { eq } from 'drizzle-orm';

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

app.get("/api/auth/magic-link/verify", async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);

  try {
    // Call verify with asResponse to get the cookies Better-Auth generates
    const authRes = await auth.api.magicLinkVerify({
      query: { token },
      headers: req.headers as any,
      asResponse: true 
    });

    const result = await authRes.json();
    if (!result?.user) return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);

    // Create the short-lived exchange code
    const code = crypto.randomUUID();
    await db.insert(exchangeCodes).values({
      code,
      userId: result.user.id,
      email: result.user.email,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?code=${code}`);
  } catch (err) {
    console.error("Magic link verification failed:", err);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
});

app.post("/api/auth/exchange-code", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  try {
    const [record] = await db.select()
      .from(exchangeCodes)
      .where(eq(exchangeCodes.code, code));

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const context = await auth.$context;

    // 1. Create the session in DB
    const session = await context.internalAdapter.createSession(
      record.userId, 
      false, 
      {
        ipAddress: req.ip || "",
        userAgent: req.headers["user-agent"] || "",
      }
    );

    // 2. Extract cookie configuration from Better-Auth context
    // In Better-Auth, authCookies holds the configuration for all cookies
    const sessionCookieConfig = context.authCookies.sessionToken;
    const cookieName = sessionCookieConfig.name;
    const cookieOptions = sessionCookieConfig.options;

    // 3. Set the cookie via Express
    res.cookie(cookieName, session.token, {
      ...cookieOptions,
      expires: session.expiresAt, // Ensure the cookie matches the DB expiry
      // Explicitly override these just in case your config is being tricky
      secure: true,
      sameSite: 'none',
      httpOnly: true,
    });

    // 4. Cleanup
    await db.delete(exchangeCodes).where(eq(exchangeCodes.code, code));

    return res.json({ status: "ok" });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: 'Failed to finalize session' });
  }
});

app.all('/api/auth/{*any}', toNodeHandler(auth));

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