// src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

import pool from './config/database';
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import adminRoutes from './routes/admin';
import usersRoutes from './routes/users';
import favouritesRoutes from './routes/favourites';
import plansRoutes from './routes/plans';
import analyticsRoutes from './routes/analytics';
import gradesRoutes from "./routes/grades";
import transcriptRoutes from "./routes/transcript";
import courseSnapshotsRoutes from "./routes/courseSnapshots";
import { makeHealthHandler } from "./routes/health";
import { extractSession } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);

const envName =
  process.env.ENVIRONMENT ??
  process.env.SISUKAS_ENV ??
  process.env.NODE_ENV ??
  "development";

const isProd = envName === "production";

let allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : ["http://localhost:5173"];

if (isProd) {
  allowedOrigins = allowedOrigins.filter((o) => {
    try {
      const u = new URL(o);
      const h = u.hostname;
      return !["localhost", "127.0.0.1", "::1"].includes(h);
    } catch {
      return false;
    }
  });
}
process.env.CORS_ORIGINS_EFFECTIVE = allowedOrigins.join(",");

// Middleware
app.use(
  cors(
    {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // keep curl / server-to-server OK
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      },
      credentials: true,
    }
  )
);

app.use(cookieParser());
app.all('/api/auth/{*any}', toNodeHandler(auth));
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Sisukas backend!' });
});

app.get("/health", makeHealthHandler(pool));

app.use("/api/course-snapshots", courseSnapshotsRoutes);

// Admin routes (login is public, logout requires admin token)
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// User routes (with extractSession applied)
app.use('/api/users', extractSession);
app.use('/api/users', usersRoutes);

// Other authenticated routes
app.use(extractSession);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/plans', plansRoutes);
app.use("/api/grades", gradesRoutes);
app.use("/api/transcript", transcriptRoutes);

app.listen(PORT, () => {
  console.log(`Environment: ${envName}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  console.log(`Server is running on ${process.env.BACKEND_URL}`);
});