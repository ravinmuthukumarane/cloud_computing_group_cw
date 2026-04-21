require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5002);

app.use(cors());
app.use(express.json());

function validateSubmission(body) {
  const { country, company, role, experienceLevel, salaryAmount, currency } = body;

  if (!country || !company || !role || !experienceLevel || !salaryAmount || !currency) {
    return 'country, company, role, experienceLevel, salaryAmount, currency are required';
  }

  if (Number(salaryAmount) <= 0) {
    return 'salaryAmount must be greater than 0';
  }

  return null;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', service: 'salary-submission' });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'database unavailable' });
  }
});

app.post('/submissions', async (req, res, next) => {
  try {
    const validationError = validateSubmission(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const {
      country,
      company,
      role,
      experienceLevel,
      salaryAmount,
      currency,
      anonymize = true,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO salary.submissions
        (country, company, role, experience_level, salary_amount, currency, anonymize, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING id, status`,
      [country, company, role, experienceLevel, salaryAmount, currency, Boolean(anonymize)]
    );

    return res.status(201).json({
      submissionId: result.rows[0].id,
      status: result.rows[0].status,
      message: 'Salary submitted successfully',
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/submissions', async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    let index = 1;

    if (req.query.status) {
      filters.push(`status = $${index++}`);
      values.push(req.query.status);
    }

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

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id,
              country,
              CASE WHEN anonymize THEN 'Anonymous' ELSE company END AS company,
              role,
              experience_level,
              salary_amount,
              currency,
              anonymize,
              status,
              created_at
       FROM salary.submissions
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      values
    );

    return res.status(200).json({
      results: result.rows.map((row) => ({
        id: row.id,
        country: row.country,
        company: row.company,
        role: row.role,
        experienceLevel: row.experience_level,
        salaryAmount: Number(row.salary_amount),
        currency: row.currency,
        anonymize: row.anonymize,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/submissions/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, country, company, role, experience_level, salary_amount,
              currency, anonymize, status, created_at
       FROM salary.submissions
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const row = result.rows[0];
    return res.status(200).json({
      id: row.id,
      country: row.country,
      company: row.company,
      role: row.role,
      experienceLevel: row.experience_level,
      salaryAmount: Number(row.salary_amount),
      currency: row.currency,
      anonymize: row.anonymize,
      status: row.status,
      createdAt: row.created_at,
    });
  } catch (error) {
    return next(error);
  }
});

app.patch('/submissions/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'APPROVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be PENDING or APPROVED' });
    }

    const result = await pool.query(
      `UPDATE salary.submissions
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING status`,
      [status, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.status(200).json({
      message: 'Submission status updated',
      status: result.rows[0].status,
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
  console.log(`salary-submission service listening on port ${PORT}`);
});
