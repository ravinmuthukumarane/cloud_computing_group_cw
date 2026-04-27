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
├── frontend/
│   └── README.md
├── k8s/
│   ├── bff/
│   ├── configmaps/
│   ├── frontend/
│   ├── identity/
│   ├── ingress/
│   ├── namespaces/
│   ├── postgres/
│   ├── salary-submission/
│   ├── search/
│   ├── stats/
│   └── vote/
├── Docs/
│   ├── final-azure-pipeline-workflow-and-troubleshooting.txt
│   ├── kubernetes-k3d-deployment-notes.txt
│   └── azure-pipeline-k3d-notes.txt
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

## 8. CI/CD and Kubernetes Deployment

The project includes an Azure DevOps pipeline in `azure-pipelines.yml`.

The pipeline:

1. Runs on pushes to `main`.
2. Uses the self-hosted agent pool `cw-cc5`.
3. Builds service Docker images.
4. Pushes images to Docker Hub using the configured Docker Hub service connections.
5. Loads the local k3d kubeconfig for `cloud-salary-cluster`.
6. Applies Kubernetes manifests and updates deployments to the current `Build.BuildId` image tag.

Detailed deployment and troubleshooting notes are in:

- `Docs/kubernetes-k3d-deployment-notes.txt`
- `Docs/azure-pipeline-k3d-notes.txt`
- `Docs/final-azure-pipeline-workflow-and-troubleshooting.txt`
