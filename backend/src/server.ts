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

app.all('/api/auth/{*any}', toNodeHandler(auth));
app.use(express.json());

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