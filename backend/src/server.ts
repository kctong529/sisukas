// src/server.js
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import pool from './config/database';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

interface TestRequest {
  name: string;
  value: number;
}

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Sisukas backend!' });
});

// Health check with detailed error logging
app.get('/health', async (req: Request, res: Response) => {
  try {
    console.log('Attempting database query...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database query successful!');
    
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

app.post('/test', (req: Request, res: Response) => {
  const data = req.body as TestRequest;
  res.json({ 
    message: 'Got your data!',
    data: data,
    nameLength: data.name.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`CORS allows requests from ${process.env.FRONTEND_URL}`);
});