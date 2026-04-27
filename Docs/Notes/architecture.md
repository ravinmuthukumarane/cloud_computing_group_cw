# Architecture

## 1. High-Level Flow

```text
Frontend -> BFF -> Identity
               -> Salary Submission
               -> Vote
               -> Search
               -> Stats

All services -> PostgreSQL (single instance, multiple schemas)
```

## 2. Database Schemas

- `identity`: users and authentication data
- `salary`: salary submissions
- `community`: votes and reports

Privacy guarantee:
- salary records do not contain user email
- public APIs never expose identity linkage

## 3. Service Ports (Local)

- Frontend: `3000` (to be created)
- BFF: `5050`
- Identity: `5001`
- Salary submission: `5002`
- Vote: `5003`
- Search: `5004`
- Stats: `5005`
- PostgreSQL: `5432`

## 4. Stateless Design

- No in-memory business state required for correctness.
- JWT used for user identity on protected operations.
- Persistent data stored in PostgreSQL only.
