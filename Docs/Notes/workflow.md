# Workflow Evidence Guide

This document describes the exact coursework workflow and the proof points to collect.

## 1. Submission

1. Anonymous user calls `POST /api/salaries`.
2. Verify DB row is inserted into `salary.submissions` with `status = 'PENDING'`.

Suggested SQL:

```sql
SELECT id, status, country, role, salary_amount, anonymize
FROM salary.submissions
ORDER BY created_at DESC
LIMIT 5;
```

## 2. Signup and Login

1. Register with `POST /api/auth/signup`.
2. Login with `POST /api/auth/login`.
3. Capture token in output as evidence of session creation.

## 3. Voting

1. Vote using `POST /api/votes` with `Authorization: Bearer <token>`.
2. Verify vote row in `community.votes`.

Suggested SQL:

```sql
SELECT submission_id, user_id, vote_type, created_at
FROM community.votes
ORDER BY created_at DESC
LIMIT 10;
```

## 4. Approval

1. Keep voting until upvotes reach threshold (`5`).
2. Verify submission changes to `APPROVED` in `salary.submissions`.

## 5. Search Visibility

1. Call `GET /api/search` with filters.
2. Verify only approved rows are returned.
3. Verify anonymized rows show company as `Anonymous`.

## 6. Stats

1. Call `GET /api/stats`.
2. Verify count/average/median/p90 changes after new approvals.
