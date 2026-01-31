// src/routes/admin.ts
import { Router, Request, Response } from 'express';
import {
  requireAdmin,
  validateAdminCredentials,
  createAdminSession,
  destroyAdminSession,
} from '../middleware/auth';

const router = Router();

/**
 * GET /api/admin/login
 * Returns an HTML login form
 */
router.get('/login', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sisukas Admin Login</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .login-container { background: white; padding: 2.5rem; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); width: 350px; }
        h1 { text-align: center; color: #333; margin-top: 0; margin-bottom: 1.5rem; }
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; color: #555; font-weight: 600; font-size: 0.9rem; }
        input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 1rem; transition: border 0.3s; }
        input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        button { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: transform 0.2s; }
        button:hover { transform: translateY(-2px); }
        button:active { transform: translateY(0); }
        .error { color: #d9534f; font-size: 0.9rem; margin-top: 1rem; text-align: center; display: none; }
        .loading { display: none; text-align: center; color: #667eea; }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>Sisukas Admin</h1>
        <form id="loginForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required autofocus>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit">Login</button>
          <div class="loading" id="loading">Logging in...</div>
          <div class="error" id="error"></div>
        </form>
      </div>
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const loading = document.getElementById('loading');
          const error = document.getElementById('error');

          loading.style.display = 'block';
          error.style.display = 'none';

          try {
            const response = await fetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            if (response.ok) {
              const data = await response.json();
              // Store token in localStorage
              localStorage.setItem('admin_token', data.token);
              // Redirect to users page
              window.location.href = '/api/users'
            } else {
              const data = await response.json();
              error.textContent = data.message || 'Invalid credentials';
              error.style.display = 'block';
              loading.style.display = 'none';
            }
          } catch (err) {
            error.textContent = 'An error occurred. Try again.';
            error.style.display = 'block';
            loading.style.display = 'none';
          }
        });
      </script>
    </body>
    </html>
  `);
});

/**
 * POST /api/admin/login
 * Verify credentials and return admin token
 * Body: { username: string, password: string }
 * Logs: All login attempts (successful and failed) with IP and user agent
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  const timestamp = new Date().toISOString();

  if (!username || !password) {
    console.warn(`[${timestamp}] [ADMIN LOGIN] Missing credentials - IP: ${clientIp}`);
    return res.status(400).json({
      error: 'Bad request',
      message: 'Username and password are required',
    });
  }

  if (!validateAdminCredentials(username, password)) {
    console.warn(`[${timestamp}] [ADMIN LOGIN FAILED] Username: ${username}, IP: ${clientIp}, User-Agent: ${userAgent}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin credentials',
    });
  }

  // Create session and return token
  const token = createAdminSession();
  console.info(`[${timestamp}] [ADMIN LOGIN SUCCESS] Username: ${username}, IP: ${clientIp}, Token: ${token.substring(0, 10)}..., User-Agent: ${userAgent}`);

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.json({
    message: 'Login successful',
    token,
  });
});

/**
 * GET /api/admin/logout
 * Destroy admin session
 * Protected: Admin only
 */
router.get('/logout', requireAdmin, (req: Request, res: Response) => {
  const token = res.locals.adminToken;
  if (token) {
    destroyAdminSession(token);
  }

  // Clear cookie
  res.clearCookie('admin_token');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Logout</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .logout-container { background: white; padding: 2.5rem; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); width: 350px; text-align: center; }
        h1 { color: #28a745; margin-top: 0; }
        p { color: #666; margin-bottom: 1.5rem; }
        a { display: inline-block; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 4px; transition: transform 0.2s; }
        a:hover { transform: translateY(-2px); }
      </style>
    </head>
    <body>
      <div class="logout-container">
        <h1>✓ Logged Out</h1>
        <p>Your admin session has been terminated.</p>
        <a href="/api/admin/login">Login Again</a>
      </div>
    </body>
    </html>
  `);
});

export default router;