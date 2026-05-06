# K3d Kubernetes Learning Journey
## Cloud Salary Transparency System — Manual Deployment Guide

This document explains every step of running the cluster manually, not just *what* to run but *why* each step exists and how everything fits together.

---

## The Big Picture First

Before any commands, understand what you are building:

```
Your Browser
    |
    | HTTP on port 8080
    v
Azure VM (public IP)
    |
    | Docker maps host:8080 → k3d load balancer
    v
k3d Load Balancer (inside Docker)
    |
    | routes to NGINX Ingress Controller
    v
NGINX Ingress (inside Kubernetes)
    |
    |-- path /api  → bff-service (port 5050)
    |-- path /     → frontend-service (port 80)
    v
BFF Service → identity / salary-submission / vote / search / stats
    |
    v
PostgreSQL (inside the cluster, port 5432, not reachable from outside)
```

k3d is not a cloud Kubernetes service. It is a wrapper that runs a full k3s (lightweight Kubernetes) cluster **inside Docker containers** on your local machine or VM. This lets you develop and test Kubernetes manifests without needing a real cloud cluster.

---

## What Is In This Repo's k8s/ Folder

```
k8s/
├── namespaces/
│   ├── app-namespace.yaml        ← creates the "app" namespace
│   └── data-namespace.yaml       ← creates the "data" namespace
│
├── configmaps/
│   └── app-config.yaml           ← non-secret config shared by all app services
│
├── secrets/
│   ├── app-secrets.yaml          ← JWT_SECRET for app namespace
│   ├── app-db-secret.yaml        ← DB_PASSWORD for app namespace pods
│   └── postgres-secret.yaml      ← POSTGRES_DB/USER/PASSWORD for data namespace
│
├── postgres/
│   ├── postgres-init-configmap.yaml   ← SQL init scripts mounted into postgres
│   ├── postgres-pvc.yaml              ← 1Gi persistent disk for postgres data
│   ├── postgres-deployment.yaml       ← the postgres pod
│   └── postgres-service.yaml          ← internal DNS name postgres.data.svc...
│
├── identity/
│   ├── identity-deployment.yaml
│   └── identity-service.yaml
│
├── salary-submission/
│   ├── salary-submission-deployment.yaml 
│   └── salary-submission-service.yaml
│
├── vote/
│   ├── vote-deployment.yaml
│   └── vote-service.yaml
│
├── search/
│   ├── search-deployment.yaml
│   └── search-service.yaml
│
├── stats/
│   ├── stats-deployment.yaml
│   └── stats-service.yaml
│
├── bff/
│   ├── bff-deployment.yaml
│   └── bff-service.yaml
│
├── frontend/
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml
│
└── ingress/
    └── app-ingress.yaml           ← routing rules: /api → bff, / → frontend
```

---

## Prerequisites — What You Need Installed

On the Azure VM:

```bash
# Check k3d is installed
k3d version

# Check kubectl is installed (or use the local ./kubectl binary in repo root)
kubectl version --client

# Check Docker is running
sudo docker ps
```

For Docker Hub access you need to be logged in (covered in the Docker Hub section below).

---

## Step 1 — Create the k3d Cluster

### Command

```bash
k3d cluster create cloud-salary-cluster \
  --servers 1 \
  --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=traefik@server:0"
```

### Why this command?

**`--servers 1 --agents 0`**
Creates a single-node cluster. One server node acts as both the control plane
(which schedules pods) and the worker (which runs pods). Fine for development.
In production you would have multiple servers and multiple agents.

**`--port "8080:80@loadbalancer"`**
This is the most important flag to understand.
k3d creates a Docker container that acts as a load balancer in front of your
cluster. This flag tells Docker: when traffic arrives on host port 8080, forward
it to port 80 on that load balancer container.
Port 80 is where NGINX Ingress listens inside the cluster.
So the chain becomes: browser → VM port 8080 → Docker → k3d load balancer port
80 → NGINX Ingress → your services.

**`--k3s-arg "--disable=traefik@server:0"`**
k3s (the Kubernetes inside k3d) automatically installs Traefik as its ingress
controller. But this project uses NGINX Ingress instead. If you let Traefik run,
it grabs port 80 first and NGINX never gets traffic. The fix is to disable
Traefik at cluster creation time.
`@server:0` means "apply this arg to server node 0".

**Why not just install NGINX without disabling Traefik?**
Both would run and fight over the same port. Traffic would land on Traefik, which
knows nothing about your ingress rules, and return 404. This was Mistake 1 in the
project history.

### Verify

```bash
sudo kubectl get nodes
```

Expected:
```
NAME                                  STATUS   ROLES                  AGE
k3d-cloud-salary-cluster-server-0     Ready    control-plane,master   Xs
```

---

## Step 2 — Install NGINX Ingress Controller

### Command

```bash
sudo kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

### Why do this separately?

An Ingress Controller is the actual program (NGINX in this case) that reads your
Ingress rules and routes HTTP traffic. The Ingress rules you write in YAML are
just configuration — without the controller running, nothing handles traffic.
The controller runs as pods inside the `ingress-nginx` namespace.

### Why use the "cloud" provider YAML?

The `cloud` provider variant configures NGINX to create a LoadBalancer type
Service. k3d detects LoadBalancer Services and wires them up to its built-in
load balancer container, which is how port 8080 on your VM connects to NGINX
inside the cluster.

### Verify

```bash
sudo kubectl get pods -n ingress-nginx
```

Wait until you see:
```
ingress-nginx-controller-xxxxx   1/1   Running
```

Also confirm Traefik is gone:
```bash
sudo kubectl get pods -A | grep -E 'traefik|nginx'
```

Expected: only nginx pods, no traefik pods.

---

## Step 3 — Namespaces

### Commands

```bash
sudo kubectl apply -f k8s/namespaces/app-namespace.yaml
sudo kubectl apply -f k8s/namespaces/data-namespace.yaml
```

### What is a namespace?

A namespace is like a folder inside Kubernetes. It groups resources and controls
access between them. This project uses two:

**`app`** — everything that runs application code: identity, salary-submission,
vote, search, stats, bff, frontend.

**`data`** — the database: postgres deployment, postgres service, postgres PVC.

### Why separate namespaces?

1. **Security isolation** — a pod in `app` cannot directly read secrets from
   `data` and vice versa. Secrets are namespace-scoped in Kubernetes.
2. **Clarity** — running `kubectl get pods -n app` shows only app pods, not
   database pods.
3. **Access control** — in a real system you would apply RBAC policies per
   namespace.

This separation caused one bug in the project: the identity deployment originally
referenced `postgres-secret` (which lives in `data`). That failed with
`CreateContainerConfigError` because Kubernetes secrets cannot cross namespaces.
The fix was to create `app-db-secret` in the `app` namespace with the same
password value.

### Verify

```bash
sudo kubectl get namespaces
```

Expected:
```
NAME              STATUS
app               Active
data              Active
ingress-nginx     Active
kube-system       Active
default           Active
```

### Files

**k8s/namespaces/app-namespace.yaml**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: app
```

**k8s/namespaces/data-namespace.yaml**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: data
```

These files simply declare that the namespaces exist. Without applying them first,
any later `kubectl apply` that references `namespace: app` or `namespace: data`
would fail.

---

## Step 4 — ConfigMaps and Secrets

This is the most important conceptual step. Before deploying any application, you
must load the configuration those applications need.

### What is a ConfigMap?

A ConfigMap stores non-sensitive key/value pairs that pods read as environment
variables or files. Think of it as a shared `.env` file that lives inside
Kubernetes.

**File:** [k8s/configmaps/app-config.yaml](../../k8s/configmaps/app-config.yaml)

**Namespace:** `app`  
**Name:** `app-config`

```
DB_HOST                  = postgres.data.svc.cluster.local
DB_PORT                  = 5432
DB_NAME                  = cloud_salary
DB_USER                  = postgres
JWT_EXPIRES_IN           = 24h
APPROVAL_UPVOTE_THRESHOLD = 1
IDENTITY_SERVICE_URL     = http://identity-service:5001
SALARY_SERVICE_URL       = http://salary-submission-service:5002
VOTE_SERVICE_URL         = http://vote-service:5003
SEARCH_SERVICE_URL       = http://search-service:5004
STATS_SERVICE_URL        = http://stats-service:5005
```

**Why `postgres.data.svc.cluster.local`?**
This is the automatic DNS name Kubernetes creates for any Service. The pattern is:
`<service-name>.<namespace>.svc.cluster.local`
The postgres Service is named `postgres` and lives in the `data` namespace.
Pods in the `app` namespace reach it using this full DNS name because they are in
a different namespace.

**Why store service URLs in a ConfigMap?**
The BFF needs to know where to find identity-service, vote-service, etc. Instead
of hardcoding URLs in each service's code, these come from environment variables
loaded from the ConfigMap. This means you can change a service URL without
rebuilding a Docker image.

Note: `http://identity-service:5001` works because Kubernetes creates a DNS
entry for every Service within the cluster. The BFF pod can reach identity on
`identity-service:5001` because both are in the `app` namespace, so the short
name resolves.

### What is a Secret?

A Secret stores sensitive data. Kubernetes stores it base64-encoded (not
encrypted by default in k3d/k3s). The key difference from a ConfigMap is that
Secrets are namespace-scoped and access-controlled, so pods in one namespace
cannot read secrets from another.

This project has three secret files.

---

**File:** [k8s/secrets/postgres-secret.yaml](../../k8s/secrets/postgres-secret.yaml)

**Namespace:** `data`  
**Name:** `postgres-secret`

```
POSTGRES_DB       = cloud_salary
POSTGRES_USER     = postgres
POSTGRES_PASSWORD = 65610
```

**Who uses this?** Only the postgres pod (which runs in the `data` namespace).
The official `postgres` Docker image reads these three env vars on first startup
to create the database, user, and set the password.

---

**File:** [k8s/secrets/app-db-secret.yaml](../../k8s/secrets/app-db-secret.yaml)

**Namespace:** `app`  
**Name:** `app-db-secret`

```
DB_PASSWORD = 65610
```

**Why does this exist separately from postgres-secret?**
Because pods in the `app` namespace (identity, salary-submission, vote, search,
stats) need the database password to connect to postgres. They cannot read
`postgres-secret` which is in the `data` namespace. So the same password value is
stored again in a separate secret inside the `app` namespace.
This was Mistake 2 in the project — the fix was creating this file.

---

**File:** [k8s/secrets/app-secrets.yaml](../../k8s/secrets/app-secrets.yaml)

**Namespace:** `app`  
**Name:** `app-secrets`

```
JWT_SECRET = coursework-local-secret
```

**Who uses this?** identity-service (signs JWTs) and bff-service (verifies JWTs).
Both pods mount this secret and read JWT_SECRET from it.

---

### Applying ConfigMaps and Secrets

```bash
sudo kubectl apply -f k8s/configmaps/app-config.yaml
sudo kubectl apply -f k8s/secrets/app-secrets.yaml
sudo kubectl apply -f k8s/secrets/app-db-secret.yaml
sudo kubectl apply -f k8s/secrets/postgres-secret.yaml
```

**Why before the deployments?**
If you apply a Deployment that references a ConfigMap or Secret that does not
exist yet, the pod will fail to start with `CreateContainerConfigError`. Always
apply configuration before workloads.

### Verify

```bash
sudo kubectl get configmaps -n app
sudo kubectl get secrets -n app
sudo kubectl get secrets -n data
```

Expected in `app`:
```
app-config
app-secrets
app-db-secret
```

Expected in `data`:
```
postgres-secret
```

---

## Step 5 — Deploy PostgreSQL

PostgreSQL needs four separate manifests applied in order.

### 5a — Init ConfigMap

```bash
sudo kubectl apply -f k8s/postgres/postgres-init-configmap.yaml
```

**File:** [k8s/postgres/postgres-init-configmap.yaml](../../k8s/postgres/postgres-init-configmap.yaml)

**Namespace:** `data`  
**Name:** `postgres-init-sql`

This ConfigMap contains three SQL scripts stored as data keys:

**001_create_schemas.sql**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS salary;
CREATE SCHEMA IF NOT EXISTS community;
```

**002_create_tables.sql**
Creates:
- `identity.users` — user accounts (UUID primary key, email, password hash, role)
- `salary.submissions` — salary records (UUID, job title, country, currency, amount, experience, approval status)
- `community.votes` — upvotes/downvotes on salary submissions
- `community.reports` — flagged submissions

**003_create_indexes.sql**
Creates indexes on commonly queried columns like email, status, country, role,
experience_level for faster search queries.

**How does postgres actually run these scripts?**
The official `postgres` Docker image runs any `.sql` file found in
`/docker-entrypoint-initdb.d/` on first startup. The Deployment mounts this
ConfigMap as a volume at that path. Kubernetes projects each data key (the
filename) as a file on disk.

### 5b — Persistent Volume Claim

```bash
sudo kubectl apply -f k8s/postgres/postgres-pvc.yaml
```

**File:** [k8s/postgres/postgres-pvc.yaml](../../k8s/postgres/postgres-pvc.yaml)

**Namespace:** `data`  
**Name:** `postgres-pvc`  
**Size:** 1Gi  
**AccessMode:** ReadWriteOnce

A PVC is a request for storage. Kubernetes (k3d uses a built-in local path
provisioner) automatically creates a PersistentVolume to satisfy this request.

**Why is this needed?**
Without persistent storage, every time the postgres pod restarts, the database
would be empty. The PVC gives postgres a real directory on the VM's disk, so data
survives pod restarts.

`ReadWriteOnce` means only one pod can write to this volume at a time — correct
for a single postgres pod.

### 5c — Postgres Deployment

```bash
sudo kubectl apply -f k8s/postgres/postgres-deployment.yaml
```

**File:** [k8s/postgres/postgres-deployment.yaml](../../k8s/postgres/postgres-deployment.yaml)

**Namespace:** `data`  
**Image:** `postgres:16-alpine`  
**Strategy:** Recreate (not RollingUpdate)

Key details:
- Reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from `postgres-secret`
- Mounts `postgres-pvc` at `/var/lib/postgresql/data` (where postgres stores data)
- Mounts `postgres-init-sql` configmap at `/docker-entrypoint-initdb.d/` (the init scripts)
- Has readiness probe: `pg_isready -U postgres -d cloud_salary` (pod not marked Ready until postgres accepts connections)
- Has liveness probe: same command, restarts the pod if postgres stops responding

**Why `Recreate` strategy?**
RollingUpdate would try to run two postgres pods simultaneously, but the PVC is
`ReadWriteOnce` — only one pod can mount it at a time. Recreate kills the old pod
first, then starts the new one.

### 5d — Postgres Service

```bash
sudo kubectl apply -f k8s/postgres/postgres-service.yaml
```

**File:** [k8s/postgres/postgres-service.yaml](../../k8s/postgres/postgres-service.yaml)

**Namespace:** `data`  
**Name:** `postgres`  
**Type:** ClusterIP (internal only, not reachable from outside the cluster)  
**Port:** 5432

This creates the DNS name `postgres.data.svc.cluster.local` that all the app
services use via the `DB_HOST` value in `app-config`.

### Verify PostgreSQL is healthy

```bash
sudo kubectl get pods -n data
sudo kubectl get pvc -n data
```

Expected:
```
NAME                        READY   STATUS    RESTARTS
postgres-xxxx               1/1     Running   0

NAME           STATUS   CAPACITY
postgres-pvc   Bound    1Gi
```

Verify the schemas and tables were created:
```bash
# List schemas
sudo kubectl exec -n data deployment/postgres -- \
  psql -U postgres -d cloud_salary -c "\dn"

# List tables in each schema
sudo kubectl exec -n data deployment/postgres -- \
  psql -U postgres -d cloud_salary -c "\dt identity.*"

sudo kubectl exec -n data deployment/postgres -- \
  psql -U postgres -d cloud_salary -c "\dt salary.*"

sudo kubectl exec -n data deployment/postgres -- \
  psql -U postgres -d cloud_salary -c "\dt community.*"
```

Expected schemas: `identity`, `salary`, `community`  
Expected tables: `identity.users`, `salary.submissions`, `community.votes`, `community.reports`

---

## Docker Hub — How Images Are Stored and Pulled

### Why Docker Hub?

Kubernetes pods do not use locally built images. When a Deployment spec says
`image: ravinmuthukumarane/bff-service:1.0.3`, Kubernetes pulls that image from
Docker Hub (or whatever registry is configured). This is because pods can run on
any node, and each node needs to be able to download the image independently.

### Which images and who owns them

| Service             | Docker Hub Image                                    | Owner             |
|---------------------|-----------------------------------------------------|-------------------|
| identity-service    | ravinmuthukumarane/identity-service:1.0.0           | ravinmuthukumarane |
| salary-submission   | ravinmuthukumarane/salary-submission-service:1.0.1  | ravinmuthukumarane |
| bff-service         | ravinmuthukumarane/bff-service:1.0.3                | ravinmuthukumarane |
| vote-service        | nipuniamarasinghe/vote-service:1.0.0                | nipuniamarasinghe  |
| search-service      | nipuniamarasinghe/search-service:1.0.0              | nipuniamarasinghe  |
| stats-service       | nipuniamarasinghe/stats-service:1.0.0               | nipuniamarasinghe  |
| frontend-service    | nipuniamarasinghe/frontend-service:1.0.7            | nipuniamarasinghe  |
| postgres            | postgres:16-alpine                                  | Official Docker Hub |

### Pulling images (reading)

If the Docker Hub repositories are public, Kubernetes pulls images without any
credentials. No login needed to pull. The images listed above are public.

If a repository is private, you would need to create a Kubernetes secret of type
`docker-registry` and reference it in the Deployment under `imagePullSecrets`.
This project does not use private repositories for the manual deployment, so no
pull credentials are needed.

### Pushing images (writing — only needed if you rebuild a service)

To push a new image to `ravinmuthukumarane/*` you must be logged in as that user:

```bash
# Log in to Docker Hub
sudo docker login
# Enter username: ravinmuthukumarane
# Enter password: (your Docker Hub password or access token)
```

After login, Docker stores credentials at `/root/.docker/config.json` (when using
sudo) or `~/.docker/config.json`.

Build and push example for bff-service:
```bash
cd services/bff

sudo docker build -t ravinmuthukumarane/bff-service:1.0.4 .
sudo docker push ravinmuthukumarane/bff-service:1.0.4
```

Then update `k8s/bff/bff-deployment.yaml` to use the new tag and re-apply:
```bash
sudo kubectl apply -f k8s/bff/bff-deployment.yaml
```

Or use `kubectl set image` to update without editing the file:
```bash
sudo kubectl set image deployment/bff bff=ravinmuthukumarane/bff-service:1.0.4 -n app
```

### imagePullPolicy

The deployments for bff, salary-submission, and frontend use:
```yaml
imagePullPolicy: Always
```

This means Kubernetes always contacts Docker Hub to check for a newer version of
the image, even if it already has it cached locally. This prevents the issue where
you push a new image with the same tag but the pod keeps using the old cached
version.

Other services use the default (`IfNotPresent`), which only pulls if the image is
not already on the node.

### Logging into a different Docker Hub account

This project uses two Docker Hub accounts. The notes reference using separate
Docker config directories to keep credentials separate:

```bash
# Push as nipuniamarasinghe using a separate config dir
sudo env DOCKER_CONFIG=/home/ravinmuthukumarane/.docker-nipuniamarasinghe \
  docker push nipuniamarasinghe/frontend-service:1.0.7
```

This lets you be logged in to both accounts simultaneously using different config
directories.

---

## Step 6 — Deploy Backend Services

These are the five internal services that hold the business logic. They all run in
the `app` namespace, connect to postgres via the ClusterIP service, and are not
reachable from outside the cluster (ClusterIP only).

### Apply all five

```bash
sudo kubectl apply -f k8s/identity/
sudo kubectl apply -f k8s/salary-submission/
sudo kubectl apply -f k8s/vote/
sudo kubectl apply -f k8s/search/
sudo kubectl apply -f k8s/stats/
```

`kubectl apply -f k8s/identity/` applies every YAML file in that directory —
both the Deployment and the Service in one command.

### What each service reads from configuration

All five services read from the same `app-config` ConfigMap and `app-db-secret`
Secret. Here is what each pod receives as environment variables:

| Env Var   | Source         | Value                              |
|-----------|----------------|------------------------------------|
| DB_HOST   | app-config     | postgres.data.svc.cluster.local    |
| DB_PORT   | app-config     | 5432                               |
| DB_NAME   | app-config     | cloud_salary                       |
| DB_USER   | app-config     | postgres                           |
| DB_PASSWORD | app-db-secret | 65610                             |

Identity service additionally reads:
- JWT_SECRET from app-secrets
- JWT_EXPIRES_IN from app-config

Vote service additionally reads:
- APPROVAL_UPVOTE_THRESHOLD from app-config (value: 1)

### Service ports

| Service             | ClusterIP Port | Pod Port | DNS name inside cluster       |
|---------------------|---------------|----------|-------------------------------|
| identity-service    | 5001          | 5001     | identity-service.app.svc...   |
| salary-submission   | 5002          | 5002     | salary-submission-service.app.|
| vote-service        | 5003          | 5003     | vote-service.app.svc...       |
| search-service      | 5004          | 5004     | search-service.app.svc...     |
| stats-service       | 5005          | 5005     | stats-service.app.svc...      |

### Health checks (readiness and liveness probes)

Every deployment has both probes hitting `GET /health`:

**Readiness probe** — Kubernetes will not send traffic to a pod until the
readiness probe passes. This prevents requests going to a pod that is still
starting up and cannot handle traffic yet.
- `initialDelaySeconds: 10` — wait 10s before first check (let the app start)
- `periodSeconds: 10` — check every 10s

**Liveness probe** — if the liveness probe fails, Kubernetes restarts the pod.
This catches cases where the app is stuck (deadlock, memory issue etc).
- `initialDelaySeconds: 30` — wait 30s before first check
- `periodSeconds: 20` — check every 20s

### Verify

```bash
sudo kubectl get pods -n app
sudo kubectl get svc -n app
```

Expected pods:
```
identity-xxxx         1/1 Running
salary-submission-xx  1/1 Running
vote-xxxx             1/1 Running
search-xxxx           1/1 Running
stats-xxxx            1/1 Running
```

Expected services:
```
identity-service          ClusterIP  xxxx  5001/TCP
salary-submission-service ClusterIP  xxxx  5002/TCP
vote-service              ClusterIP  xxxx  5003/TCP
search-service            ClusterIP  xxxx  5004/TCP
stats-service             ClusterIP  xxxx  5005/TCP
```

Check logs if a pod is not Running:
```bash
sudo kubectl logs -n app deployment/identity
sudo kubectl logs -n app deployment/vote
# etc
```

---

## Step 7 — Deploy the BFF (Backend For Frontend)

```bash
sudo kubectl apply -f k8s/bff/
```

**File:** [k8s/bff/bff-deployment.yaml](../../k8s/bff/bff-deployment.yaml)

**Image:** `ravinmuthukumarane/bff-service:1.0.3`  
**Port:** 5050

The BFF is the single entry point for the frontend. Instead of the React app
calling five different services, it calls one BFF which fans out to the correct
service. The BFF also handles JWT validation using `JWT_SECRET`.

What the BFF reads from configuration:

| Env Var              | Source       | Value                                          |
|----------------------|--------------|------------------------------------------------|
| PORT                 | literal      | 5050                                           |
| JWT_SECRET           | app-secrets  | coursework-local-secret                        |
| IDENTITY_SERVICE_URL | app-config   | http://identity-service:5001                   |
| SALARY_SERVICE_URL   | app-config   | http://salary-submission-service:5002          |
| VOTE_SERVICE_URL     | app-config   | http://vote-service:5003                       |
| SEARCH_SERVICE_URL   | app-config   | http://search-service:5004                     |
| STATS_SERVICE_URL    | app-config   | http://stats-service:5005                      |

Notice: the BFF does NOT connect to postgres directly. It only talks to other
services using their ClusterIP DNS names.

### Verify

```bash
sudo kubectl get pods -n app -l app=bff
sudo kubectl logs -n app deployment/bff
```

Expected log: `bff service listening on port 5050`

---

## Step 8 — Deploy the Frontend

```bash
sudo kubectl apply -f k8s/frontend/
```

**File:** [k8s/frontend/frontend-deployment.yaml](../../k8s/frontend/frontend-deployment.yaml)

**Image:** `nipuniamarasinghe/frontend-service:1.0.7`  
**Port:** 80 (NGINX serves the React static files)

### Critical: the frontend image must use `/api` as the API base URL

The React app is a static build. The API base URL is baked in at build time by
the Vite build arg `VITE_API_BASE_URL`. In Kubernetes, because the NGINX Ingress
routes `/api` to the BFF, the frontend must call `/api` (a relative path), not
`http://localhost:5050/api` (which was used for Docker Compose and does not work
in Kubernetes).

To verify the built image has the correct URL:
```bash
# First get the JS asset filename from the HTML
curl -s http://localhost:8080/ | grep assets

# Then check the URL embedded in that JS file
curl -s http://localhost:8080/assets/index-XXXXXXXX.js | grep -o "http://localhost:5050/api\|/api" | head
```

Expected output: `/api` (not `http://localhost:5050/api`).

If it shows `http://localhost:5050/api`, the image was built for Docker Compose
and must be rebuilt with `--build-arg VITE_API_BASE_URL=/api`.

### Verify

```bash
sudo kubectl get pods -n app -l app=frontend
sudo kubectl logs -n app deployment/frontend
```

Expected: NGINX startup logs, pod 1/1 Running.

---

## Step 9 — Apply the Ingress Rules

```bash
sudo kubectl apply -f k8s/ingress/app-ingress.yaml
```

**File:** [k8s/ingress/app-ingress.yaml](../../k8s/ingress/app-ingress.yaml)

**Namespace:** `app`  
**Name:** `app-ingress`  
**IngressClass:** `nginx`

Rules:
```
/api  (Prefix match) → bff-service port 5050
/     (Prefix match) → frontend-service port 80
```

### Why is this the last step?

The Ingress rules reference `bff-service` and `frontend-service`. Those Services
need to exist before the Ingress is applied (otherwise NGINX Ingress controller
logs warnings about missing backends). More importantly, it makes no sense to
route traffic before the pods behind the services are ready.

### How NGINX Ingress works with this

The NGINX Ingress controller watches for Ingress resources. When you apply
`app-ingress.yaml`, the controller reads the rules and reconfigures its internal
NGINX process. Requests to `/api/...` get proxied to `bff-service:5050`. All
other requests get proxied to `frontend-service:80`.

### Verify

```bash
sudo kubectl get ingress -n app
sudo kubectl describe ingress app-ingress -n app
```

Expected rules section:
```
Rules:
  Host  Path   Backends
  ----  ----   --------
  *     /api   bff-service:5050
        /      frontend-service:80
```

---

## Step 10 — Final Testing

### On the VM (local test)

```bash
# Frontend loads
curl http://localhost:8080/

# Search returns empty results (expected with fresh database)
curl http://localhost:8080/api/search

# Stats returns zeros (expected with no approved submissions)
curl http://localhost:8080/api/stats
```

Expected:
```json
{"results":[]}
{"count":0,"average":null,"median":null,"p90":null,"currency":"MULTI"}
```

### From outside (external browser test)

Open in browser: `http://<VM_PUBLIC_IP>:8080/`

Requirements:
- Azure NSG inbound rule for TCP port 8080 must be open
- The k3d cluster must be running

---

## Troubleshooting Reference

### Check all pods across the cluster
```bash
sudo kubectl get pods -A
```

### Pod is in CrashLoopBackOff or Error
```bash
sudo kubectl logs -n app deployment/<service-name>
sudo kubectl describe pod -n app <pod-name>
```

### Pod is in CreateContainerConfigError
The pod cannot find a referenced ConfigMap or Secret. Check:
```bash
sudo kubectl get configmaps -n app
sudo kubectl get secrets -n app
```
Make sure `app-config`, `app-secrets`, and `app-db-secret` all exist in `app`.

### Pod is in ImagePullBackOff or ErrImagePull
The image tag does not exist on Docker Hub. Check the image name and tag in the
deployment YAML matches what was pushed to Docker Hub.

### curl http://localhost:8080/ returns "404 page not found"
Traefik is interfering. Check:
```bash
sudo kubectl get pods -A | grep traefik
```
If traefik pods appear, the cluster was created without `--disable=traefik`. You
must delete the cluster and recreate it with the correct flag.

### Delete and recreate the cluster
```bash
k3d cluster delete cloud-salary-cluster

k3d cluster create cloud-salary-cluster \
  --servers 1 \
  --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=traefik@server:0"
```
Then repeat all steps from Step 2 onward.

### List existing k3d clusters
```bash
k3d cluster list
```

### Stop and start the cluster without deleting it
```bash
k3d cluster stop cloud-salary-cluster
k3d cluster start cloud-salary-cluster
```
Note: after start, run `kubectl get nodes` and wait for Ready before testing.

---

## Full Command Sequence — Quick Reference

```bash
# 1. Create cluster
k3d cluster create cloud-salary-cluster \
  --servers 1 --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=traefik@server:0"

sudo kubectl get nodes

# 2. NGINX Ingress
sudo kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
sudo kubectl get pods -n ingress-nginx

# 3. Namespaces
sudo kubectl apply -f k8s/namespaces/app-namespace.yaml
sudo kubectl apply -f k8s/namespaces/data-namespace.yaml

# 4. ConfigMaps and Secrets
sudo kubectl apply -f k8s/configmaps/app-config.yaml
sudo kubectl apply -f k8s/secrets/app-secrets.yaml
sudo kubectl apply -f k8s/secrets/app-db-secret.yaml
sudo kubectl apply -f k8s/secrets/postgres-secret.yaml

# 5. PostgreSQL
sudo kubectl apply -f k8s/postgres/postgres-init-configmap.yaml
sudo kubectl apply -f k8s/postgres/postgres-pvc.yaml
sudo kubectl apply -f k8s/postgres/postgres-deployment.yaml
sudo kubectl apply -f k8s/postgres/postgres-service.yaml
sudo kubectl get pods -n data

# 6. Backend services
sudo kubectl apply -f k8s/identity/
sudo kubectl apply -f k8s/salary-submission/
sudo kubectl apply -f k8s/vote/
sudo kubectl apply -f k8s/search/
sudo kubectl apply -f k8s/stats/

# 7. BFF
sudo kubectl apply -f k8s/bff/

# 8. Frontend
sudo kubectl apply -f k8s/frontend/

# 9. Ingress
sudo kubectl apply -f k8s/ingress/app-ingress.yaml

# 10. Verify everything
sudo kubectl get pods -n app
sudo kubectl get pods -n data
sudo kubectl get svc -n app
sudo kubectl get ingress -n app

# 11. Test
curl http://localhost:8080/
curl http://localhost:8080/api/search
curl http://localhost:8080/api/stats
```
