require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5005);

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', service: 'stats' });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'database unavailable' });
  }
});

app.get('/stats', async (req, res, next) => {
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
        COUNT(*)::INT AS count,
        AVG(salary_amount)::NUMERIC(12,2) AS average,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_amount)::NUMERIC(12,2) AS median,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY salary_amount)::NUMERIC(12,2) AS p90,
        CASE WHEN COUNT(DISTINCT currency) = 1 THEN MIN(currency) ELSE 'MULTI' END AS currency
      FROM salary.submissions
      WHERE ${filters.join(' AND ')}
    `;

    const result = await pool.query(query, values);
    const row = result.rows[0];

    return res.status(200).json({
      count: row.count,
      average: row.average !== null ? Number(row.average) : null,
      median: row.median !== null ? Number(row.median) : null,
      p90: row.p90 !== null ? Number(row.p90) : null,
      currency: row.currency,
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
  console.log(`stats service listening on port ${PORT}`);
});
