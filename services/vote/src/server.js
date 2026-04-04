require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { pool } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 5003);
const APPROVAL_THRESHOLD = Number(process.env.APPROVAL_UPVOTE_THRESHOLD || 5);

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', service: 'vote' });
  } catch (error) {
    return res.status(503).json({ status: 'error', message: 'database unavailable' });
  }
});

app.post('/votes', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { submissionId, userId, voteType } = req.body;

    if (!submissionId || !userId || !voteType) {
      return res.status(400).json({ error: 'submissionId, userId, voteType are required' });
    }

    if (!['UPVOTE', 'DOWNVOTE'].includes(voteType)) {
      return res.status(400).json({ error: 'voteType must be UPVOTE or DOWNVOTE' });
    }

    await client.query('BEGIN');

    const submissionCheck = await client.query(
      `SELECT id, status
       FROM salary.submissions
       WHERE id = $1`,
      [submissionId]
    );

    if (submissionCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found' });
    }

    try {
      await client.query(
        `INSERT INTO community.votes (submission_id, user_id, vote_type)
         VALUES ($1, $2, $3)`,
        [submissionId, userId, voteType]
      );
    } catch (error) {
      if (error.code === '23505') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'User has already voted on this submission' });
      }
      throw error;
    }

    const voteCountsResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE vote_type = 'UPVOTE')::INT AS upvotes,
         COUNT(*) FILTER (WHERE vote_type = 'DOWNVOTE')::INT AS downvotes
       FROM community.votes
       WHERE submission_id = $1`,
      [submissionId]
    );

    const upvotes = voteCountsResult.rows[0].upvotes;
    const downvotes = voteCountsResult.rows[0].downvotes;
    const currentScore = upvotes - downvotes;

    let submissionStatus = submissionCheck.rows[0].status;

    if (upvotes >= APPROVAL_THRESHOLD && submissionStatus !== 'APPROVED') {
      const updateResult = await client.query(
        `UPDATE salary.submissions
         SET status = 'APPROVED',
             updated_at = NOW()
         WHERE id = $1
         RETURNING status`,
        [submissionId]
      );

      submissionStatus = updateResult.rows[0].status;
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Vote recorded',
      submissionStatus,
      upvotes,
      downvotes,
      currentScore,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

app.get('/votes/submission/:submissionId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE vote_type = 'UPVOTE')::INT AS upvotes,
         COUNT(*) FILTER (WHERE vote_type = 'DOWNVOTE')::INT AS downvotes
       FROM community.votes
       WHERE submission_id = $1`,
      [req.params.submissionId]
    );

    const upvotes = result.rows[0].upvotes;
    const downvotes = result.rows[0].downvotes;

    return res.status(200).json({
      submissionId: req.params.submissionId,
      upvotes,
      downvotes,
      currentScore: upvotes - downvotes,
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
  console.log(`vote service listening on port ${PORT}`);
});
