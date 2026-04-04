# Cloud Salary Transparency System

Project for cloud-native microservice development.

This repository implements the required workflow:

submission -> voting -> approval -> search -> stats

## 1. Implemented Scope (Current)

- PostgreSQL schema initialization scripts
- Identity service (`/signup`, `/login`, `/validate`)
- Salary submission service (`/submissions`)
- Vote service (`/votes`, threshold approval)
- Search service (`/search`)
- Stats service (`/stats`)
- BFF (`/api/*` public interface)
- Service health endpoints (`/health`)
- Documentation:
	- architecture
	- workflow and evidence checklist
	- API reference

## 2. Repository Structure

```text
.
├── frontend/
│   └── README.md
└── services/
		├── bff/
		├── identity/
		├── salary-submission/
		├── search/
		├── stats/
		└── vote/
```

## 3. Prerequisites (macOS)

- Node.js 18+
- npm 9+
- PostgreSQL installed locally


## 4. Install Dependencies

```bash
npm install --prefix services/identity
npm install --prefix services/salary-submission
npm install --prefix services/vote
npm install --prefix services/search
npm install --prefix services/stats
npm install --prefix services/bff
```

## 5. Run Services (Local)

Run each in a separate terminal:

```bash
npm start --prefix services/identity
npm start --prefix services/salary-submission
npm start --prefix services/vote
npm start --prefix services/search
npm start --prefix services/stats
npm start --prefix services/bff
```

## 6. Public API Endpoints (BFF)

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/salaries`
- `POST /api/votes` (protected)
- `GET /api/search`
- `GET /api/stats`


## 7. Minimum Vertical Slice Test

1. Submit salary (anonymous)
2. Confirm DB row status is `PENDING`
3. Signup + login to get JWT
4. Vote with JWT
5. Reach upvote threshold (`>= 5`) and confirm `APPROVED`
6. Verify record appears in search
7. Verify stats include approved data

