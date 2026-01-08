// src/config/database.ts

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sisukas',
  user: process.env.DB_USER || 'sisukas_user',
  password: process.env.DB_PASSWORD || 'dev_password',
});

export default pool;