# Cloud Salary Transparency System

Coursework project for cloud-native microservice development.

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
- React frontend
- Dockerfiles and Docker Compose setup
- Kubernetes manifests for k3d deployment
- Azure DevOps pipeline for Docker image build/push and k3d deployment
- Service health endpoints (`/health`)
- Documentation:
	- architecture
	- workflow and evidence checklist
	- API reference
	- Kubernetes deployment notes
	- Azure Pipeline workflow and troubleshooting notes

## 2. Repository Structure

```text
.
├── Docs/
│   ├── SQL Files/
│   │   ├── 001_create_schemas.sql
│   │   ├── 002_create_tables.sql
│   │   └── 003_create_indexes.sql
│   ├── api-documentation.md
│   ├── architecture.md
│   ├── copilot_coursework_instructions.txt
│   ├── database-design.txt
│   ├── service-design.txt
│   └── workflow.md
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

## 4. Database Setup

Create DB:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE cloud_salary;"
```

Apply schema scripts in order:

```bash
psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/001_create_schemas.sql"
psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/002_create_tables.sql"
psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/003_create_indexes.sql"
```

If you want non-interactive execution:

```bash
PGPASSWORD=65620 psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/001_create_schemas.sql"
PGPASSWORD=65620 psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/002_create_tables.sql"
PGPASSWORD=65620 psql -U postgres -h localhost -d cloud_salary -f "Docs/SQL Files/003_create_indexes.sql"
```

## 5. Configure Environment Files

For each service, copy environment template:

```bash
cp services/identity/.env.example services/identity/.env
cp services/salary-submission/.env.example services/salary-submission/.env
cp services/vote/.env.example services/vote/.env
cp services/search/.env.example services/search/.env
cp services/stats/.env.example services/stats/.env
cp services/bff/.env.example services/bff/.env
```

Set same `JWT_SECRET` in:
- `services/identity/.env`
- `services/bff/.env`

## 6. Install Dependencies

```bash
npm install --prefix services/identity
npm install --prefix services/salary-submission
npm install --prefix services/vote
npm install --prefix services/search
npm install --prefix services/stats
npm install --prefix services/bff
```

## 7. Run Services (Local)

Run each in a separate terminal:

```bash
npm start --prefix services/identity
npm start --prefix services/salary-submission
npm start --prefix services/vote
npm start --prefix services/search
npm start --prefix services/stats
npm start --prefix services/bff
```

## 8. Public API Endpoints (BFF)

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/salaries`
- `POST /api/votes` (protected)
- `GET /api/search`
- `GET /api/stats`

Detailed request/response examples:
- see `Docs/api-documentation.md`

## 9. Minimum Vertical Slice Test

1. Submit salary (anonymous)
2. Confirm DB row status is `PENDING`
3. Signup + login to get JWT
4. Vote with JWT
5. Reach upvote threshold (`>= 5`) and confirm `APPROVED`
6. Verify record appears in search
7. Verify stats include approved data

See `Docs/workflow.md` for evidence commands.

## 10. Final Report Evidence

The main implementation, containerization, Kubernetes manifests, and Azure
Pipeline deployment workflow are now complete.

Remaining report/evidence work:

- Capture final Azure Pipeline success screenshots.
- Capture Kubernetes pod, service, ingress, and rollout evidence.
- Capture application access evidence through the VM public IP on port 8080.
- Summarize the CI/CD troubleshooting process using:
  `Docs/final-azure-pipeline-workflow-and-troubleshooting.txt`
