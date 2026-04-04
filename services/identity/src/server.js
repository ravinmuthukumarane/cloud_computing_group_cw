require('dotenv').config();

const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');

const { pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5001);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

app.use(cors());
app.use(express.json());

function validateSignupInput(body) {
  const { email, password } = body;
  if (!email || !password) return 'email and password are required';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'email format is invalid';
  if (password.length < 8) return 'password must be at least 8 characters';
  return null;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', service: 'identity' });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'database unavailable' });
  }
});

app.post('/signup', async (req, res, next) => {
  try {
    const validationError = validateSignupInput(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO identity.users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id`,
      [email.toLowerCase(), passwordHash]
    );

    return res.status(201).json({
      message: 'User created successfully',
      user: { id: result.rows[0].id },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return next(error);
  }
});

app.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM identity.users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(200).json({
      token,
      user: { id: user.id },
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/validate', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false, error: 'token is required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ valid: true, user: { id: payload.sub } });
  } catch (error) {
    return res.status(401).json({ valid: false, error: 'invalid token' });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`identity service listening on port ${PORT}`);
});
