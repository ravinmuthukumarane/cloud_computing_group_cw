# API Documentation - Cloud Salary Transparency System

## 1. Overview

All external client requests go through BFF.

Base URL (local):

```text
http://localhost:5000/api
```

## 2. Authentication

Protected endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

## 3. Public Endpoints (BFF)

### 3.1 Signup

- Method: `POST`
- Path: `/auth/signup`
- Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

- Success `201`:

```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid"
  }
}
```

- Errors:
  - `400` invalid input
  - `409` email exists

### 3.2 Login

- Method: `POST`
- Path: `/auth/login`
- Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

- Success `200`:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid"
  }
}
```

- Errors:
  - `400` invalid request
  - `401` invalid credentials

### 3.3 Salary Submission (Anonymous)

- Method: `POST`
- Path: `/salaries`
- Request:

```json
{
  "country": "Sri Lanka",
  "company": "WSO2",
  "role": "Software Engineer",
  "experienceLevel": "Mid",
  "salaryAmount": 350000,
  "currency": "LKR",
  "anonymize": true
}
```

- Success `201`:

```json
{
  "submissionId": "uuid",
  "status": "PENDING",
  "message": "Salary submitted successfully"
}
```

- Errors:
  - `400` validation failed

### 3.4 Vote (Authenticated)

- Method: `POST`
- Path: `/votes`
- Headers: Authorization bearer token required
- Request:

```json
{
  "submissionId": "uuid",
  "voteType": "UPVOTE"
}
```

- Success `201`:

```json
{
  "message": "Vote recorded",
  "submissionStatus": "PENDING",
  "upvotes": 3,
  "downvotes": 0,
  "currentScore": 3
}
```

- Errors:
  - `401` unauthorized
  - `404` submission not found
  - `409` duplicate vote

Approval rule:
- `upvotes >= 5` changes submission to `APPROVED`.

### 3.5 Search (Public)

- Method: `GET`
- Path: `/search`
- Query params (optional):
  - `country`
  - `company`
  - `role`
  - `experienceLevel`

Example:

```http
GET /api/search?country=Sri%20Lanka&role=Software%20Engineer
```

- Success `200`:

```json
{
  "results": [
    {
      "id": "uuid",
      "country": "Sri Lanka",
      "company": "Anonymous",
      "role": "Software Engineer",
      "experienceLevel": "Mid",
      "salaryAmount": 350000,
      "currency": "LKR",
      "createdAt": "2026-04-04T10:00:00.000Z"
    }
  ]
}
```

Behavior:
- only `APPROVED` rows are returned
- if `anonymize = true`, company is returned as `Anonymous`

### 3.6 Stats (Public)

- Method: `GET`
- Path: `/stats`
- Query params (optional):
  - `country`
  - `company`
  - `role`
  - `experienceLevel`

Example:

```http
GET /api/stats?country=Sri%20Lanka&role=Software%20Engineer
```

- Success `200`:

```json
{
  "count": 12,
  "average": 410000,
  "median": 395000,
  "p90": 550000,
  "currency": "LKR"
}
```

Behavior:
- only `APPROVED` rows are used in aggregation
- `currency` is `MULTI` if multiple currencies are present

## 4. Health Endpoints

Each service exposes `/health`.

- BFF: `http://localhost:5000/health`
- Identity: `http://localhost:5001/health`
- Salary submission: `http://localhost:5002/health`
- Vote: `http://localhost:5003/health`
- Search: `http://localhost:5004/health`
- Stats: `http://localhost:5005/health`

## 5. Internal Service APIs

Identity service (`5001`):
- `POST /signup`
- `POST /login`
- `POST /validate`

Salary submission service (`5002`):
- `POST /submissions`
- `GET /submissions/:id`
- `PATCH /submissions/:id/status`

Vote service (`5003`):
- `POST /votes`
- `GET /votes/submission/:submissionId`

Search service (`5004`):
- `GET /search`

Stats service (`5005`):
- `GET /stats`
