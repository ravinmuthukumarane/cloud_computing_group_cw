require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5004);

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', service: 'search' });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'database unavailable' });
  }
});

app.get('/search', async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    let index = 1;

    filters.push(`status = 'APPROVED'`);

    if (req.query.country) {
      filters.push(`country ILIKE $${index++}`);
      values.push(req.query.country);
    }

    if (req.query.company) {
      filters.push(`company ILIKE $${index++}`);
      values.push(req.query.company);
    }

    if (req.query.role) {
      filters.push(`role ILIKE $${index++}`);
      values.push(req.query.role);
    }

    if (req.query.experienceLevel) {
      filters.push(`experience_level ILIKE $${index++}`);
      values.push(req.query.experienceLevel);
    }

    const query = `
      SELECT
        id,
        country,
        CASE WHEN anonymize THEN 'Anonymous' ELSE company END AS company,
        role,
        experience_level,
        salary_amount,
        currency,
        created_at
      FROM salary.submissions
      WHERE ${filters.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      results: result.rows.map((row) => ({
        id: row.id,
        country: row.country,
        company: row.company,
        role: row.role,
        experienceLevel: row.experience_level,
        salaryAmount: Number(row.salary_amount),
        currency: row.currency,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`search service listening on port ${PORT}`);
});
