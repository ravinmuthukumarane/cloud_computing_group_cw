require('dotenv').config();

const axios = require('axios');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = Number(process.env.PORT || 5000);

const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:5001';
const SALARY_SERVICE_URL = process.env.SALARY_SERVICE_URL || 'http://localhost:5002';
const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://localhost:5003';
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:5004';
const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || 'http://localhost:5005';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

function handleProxyError(error, res) {
  if (error.response) {
    return res.status(error.response.status).json(error.response.data);
  }
  return res.status(502).json({ error: 'Upstream service unavailable' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: payload.sub };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.get('/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', service: 'bff' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const response = await axios.post(`${IDENTITY_SERVICE_URL}/signup`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${IDENTITY_SERVICE_URL}/login`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.post('/api/salaries', async (req, res) => {
  try {
    const response = await axios.post(`${SALARY_SERVICE_URL}/submissions`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    const response = await axios.get(`${SALARY_SERVICE_URL}/submissions`, {
      params: req.query,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.post('/api/votes', authMiddleware, async (req, res) => {
  try {
    const submissionId = req.body.submissionId || req.body.id;
    const payload = {
      submissionId,
      voteType: req.body.voteType,
      userId: req.user.id,
    };

    const response = await axios.post(`${VOTE_SERVICE_URL}/votes`, payload);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const response = await axios.get(`${SEARCH_SERVICE_URL}/search`, {
      params: req.query,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const response = await axios.get(`${STATS_SERVICE_URL}/stats`, {
      params: req.query,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return handleProxyError(error, res);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`bff service listening on port ${PORT}`);
});
