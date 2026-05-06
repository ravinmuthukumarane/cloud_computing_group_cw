# Azure Pipeline Learning Journey
## Cloud Salary Transparency System — CI/CD Pipeline Guide

This document explains every part of [azure-pipelines.yml](../../azure-pipelines.yml),
not just what each line does but *why* it exists, how it was set up, and the
problems that were encountered and fixed.

---

## The Big Picture First

The pipeline automates the two manual tasks that would otherwise be done by hand:

1. **Build Docker images and push them to Docker Hub** — instead of running
   `docker build` and `docker push` locally
2. **Deploy updated images to the k3d Kubernetes cluster** — instead of running
   `kubectl apply` and `kubectl set image` manually

```
Developer pushes to main branch
        |
        v
Azure DevOps detects the push (webhook trigger)
        |
        v
Stage 1: BuildAndPush
  ├── Login to Docker Hub (ravinmuthukumarane account)
  ├── Build + push: bff-service, identity-service, salary-submission-service
  ├── Login to Docker Hub (nipuniamarasinghe account)
  └── Build + push: vote-service, search-service, stats-service, frontend-service
        |
        v
Stage 2: DeployToK3d (only runs if Stage 1 succeeded)
  ├── Load k3d kubeconfig
  ├── Apply namespaces, ConfigMaps, Secrets
  ├── Apply PostgreSQL manifests
  ├── Apply app service manifests
  ├── Apply ingress
  ├── kubectl set image → update each deployment to the new image tag
  └── kubectl rollout status → wait for all pods to come up
        |
        v
http://VM_PUBLIC_IP:8080/ serves the updated application
```

**One important constraint:** the k3d cluster runs locally on the Azure VM.
The pipeline cannot create the cluster itself — the cluster must already be
running before any pipeline job starts. See
[k3d-learning-journey.md](k3d-learning-journey.md) for cluster setup.

---

## What Is Azure DevOps / Azure Pipelines?

Azure DevOps is Microsoft's platform for hosting code repositories, CI/CD
pipelines, work tracking, and artifact storage. Azure Pipelines is the CI/CD
component.

A pipeline is defined in a YAML file (`azure-pipelines.yml`) that lives in the
repository. Azure DevOps reads this file every time a pipeline run is triggered
and executes the steps defined in it.

The key concepts used in this pipeline:

| Term              | Meaning                                                               |
|-------------------|-----------------------------------------------------------------------|
| Trigger           | When to start a run (which branch, PR events, manual)                 |
| Stage             | A group of jobs that runs as a unit; stages run sequentially          |
| Job               | A group of steps that runs on one agent                               |
| Step              | A single task or script inside a job                                  |
| Agent             | The machine that actually runs the job steps                          |
| Service connection| Stored credentials (Docker Hub, Azure, etc.) referenced by tasks      |
| Variable          | A named value reused across the pipeline                              |
| Build.BuildId     | A built-in Azure DevOps variable: a unique integer for each run       |

---

## The Pipeline File Line by Line

### Trigger

```yaml
trigger:
  branches:
    include:
      - main

pr: none
```

**`trigger: branches: include: main`**
Azure DevOps watches for Git push events. When any commit lands on the `main`
branch (either via a direct push or a merged PR), the pipeline starts
automatically.

**`pr: none`**
Disables the pull request validation trigger. Without this line, Azure DevOps
would also run the pipeline for every PR opened against main. Since this project
uses the pipeline for deployment (not just testing), it only makes sense to run
after the merge, not before.

---

### Variables

```yaml
variables:
  imageTag: '$(Build.BuildId)'
  ravinDockerHubNamespace: 'ravinmuthukumarane'
  nipuniDockerHubNamespace: 'nipuniamarasinghe'
  selfHostedPoolName: 'cw-cc5'
  k3dClusterName: 'cloud-salary-cluster'
```

**`imageTag: '$(Build.BuildId)'`**
`Build.BuildId` is a number Azure DevOps automatically increments with each run
(e.g., `42`, `43`, `44`). Using it as the image tag means every pipeline run
produces uniquely tagged images like `ravinmuthukumarane/bff-service:42`.

Why unique tags? If every run used the same tag (like `latest`), Kubernetes
might not detect that the image changed and would keep running the old version.
Unique build IDs guarantee a new image pull on every deployment.

**`ravinDockerHubNamespace` and `nipuniDockerHubNamespace`**
These are used as prefixes in every `docker build` and `docker push` command.
Storing them as variables means if you ever rename a Docker Hub account, you
change one line instead of searching every build command.

**`selfHostedPoolName: 'cw-cc5'`**
The name of the Azure DevOps agent pool the pipeline submits jobs to. Both
stages use the same pool. This name must match exactly what is registered in
Azure DevOps → Project Settings → Agent Pools.

**`k3dClusterName: 'cloud-salary-cluster'`**
The name given to the k3d cluster when it was created. Used in the deploy stage
to load the correct kubeconfig.

---

## Stage 1 — BuildAndPush

```yaml
- stage: BuildAndPush
  displayName: Build and push Docker images
  jobs:
    - job: BuildImages
      displayName: Build service images
      pool:
        name: $(selfHostedPoolName)
```

**Why `pool: name: $(selfHostedPoolName)`?**
The `pool` field tells Azure DevOps which agent pool to send this job to. Both
stages use the self-hosted pool (`cw-cc5`), which means the job runs on the Azure
VM rather than a Microsoft-hosted cloud agent. This is required for the deploy
stage (covered below), and it's consistent to use the same machine for building
too.

### Steps

#### `checkout: self`

```yaml
- checkout: self
```

Downloads the repository source code onto the agent's workspace. Without this,
the `services/` and `frontend/` directories would not exist and `docker build`
would fail. The agent downloads a clean copy of the branch that triggered the
pipeline.

---

#### Login to Docker Hub — ravinmuthukumarane

```yaml
- task: Docker@2
  displayName: Login to Docker Hub - ravinmuthukumarane
  inputs:
    command: login
    containerRegistry: dockerhub-ravinmuthukumarane
```

**What is a Docker@2 task?**
`Docker@2` is a built-in Azure Pipelines task that wraps Docker commands. It
handles credential retrieval and constructs the correct `docker login` invocation
using credentials stored securely in Azure DevOps.

**What is `containerRegistry: dockerhub-ravinmuthukumarane`?**
This is a *service connection* — a named set of credentials stored in Azure
DevOps under Project Settings → Service connections. The name
`dockerhub-ravinmuthukumarane` was created there with the Docker Hub username
and password (or access token) for the `ravinmuthukumarane` account.

The pipeline never contains the actual Docker Hub password. The service
connection name is a reference; Azure DevOps injects the real credentials at
runtime.

**How to create a service connection in Azure DevOps:**
1. Go to Project Settings → Service connections
2. New service connection → Docker Registry
3. Select Docker Hub
4. Enter Docker ID and password (or access token)
5. Name it `dockerhub-ravinmuthukumarane`
6. Grant pipeline access

**Important:** The first time a pipeline uses a service connection, Azure DevOps
asks you to authorize it. You must approve this in the pipeline run UI before
the step can proceed.

---

#### Build and push ravinmuthukumarane images

```yaml
- script: |
    set -e
    docker build -t $(ravinDockerHubNamespace)/bff-service:$(imageTag) services/bff
    docker build -t $(ravinDockerHubNamespace)/identity-service:$(imageTag) services/identity
    docker build -t $(ravinDockerHubNamespace)/salary-submission-service:$(imageTag) services/salary-submission
    docker push $(ravinDockerHubNamespace)/bff-service:$(imageTag)
    docker push $(ravinDockerHubNamespace)/identity-service:$(imageTag)
    docker push $(ravinDockerHubNamespace)/salary-submission-service:$(imageTag)
  displayName: Build and push ravinmuthukumarane images
```

**`set -e`**
Stops the script immediately if any command fails. Without this, the script would
continue and possibly push a broken or non-existent image, causing silent failures
downstream in Kubernetes.

**`docker build -t ravinmuthukumarane/bff-service:42 services/bff`**
Builds the Docker image using the Dockerfile at `services/bff/Dockerfile`. Tags
the result as `ravinmuthukumarane/bff-service:42` (where 42 is the Build.BuildId).

**`docker push ...`**
Uploads the image to Docker Hub. Requires the Docker Hub login from the previous
step to still be active. This is why build and push happen immediately after
login — before the other account's login overwrites the credentials.

---

#### Login to Docker Hub — nipuniamarasinghe, then build and push

```yaml
- task: Docker@2
  displayName: Login to Docker Hub - nipuniamarasinghe
  inputs:
    command: login
    containerRegistry: dockerhub-nipuniamarasinghe

- script: |
    set -e
    docker build -t $(nipuniDockerHubNamespace)/vote-service:$(imageTag) services/vote
    docker build -t $(nipuniDockerHubNamespace)/search-service:$(imageTag) services/search
    docker build -t $(nipuniDockerHubNamespace)/stats-service:$(imageTag) services/stats
    docker build --build-arg VITE_API_BASE_URL=/api -t $(nipuniDockerHubNamespace)/frontend-service:$(imageTag) frontend
    docker push $(nipuniDockerHubNamespace)/vote-service:$(imageTag)
    docker push $(nipuniDockerHubNamespace)/search-service:$(imageTag)
    docker push $(nipuniDockerHubNamespace)/stats-service:$(imageTag)
    docker push $(nipuniDockerHubNamespace)/frontend-service:$(imageTag)
  displayName: Build and push nipuniamarasinghe images
```

**Why does the login/push order matter?**
Docker stores one active session per registry. When you log in to a second Docker
Hub account, it overwrites the first login. If both accounts logged in before any
pushes happened, pushing `ravinmuthukumarane/*` images while authenticated as
`nipuniamarasinghe` would fail with "push access denied".

The solution is to log in and push for each account in sequence:
1. Login ravinmuthukumarane → push ravinmuthukumarane images → then login
   nipuniamarasinghe → push nipuniamarasinghe images.

This was Issue 5 encountered during development.

**`--build-arg VITE_API_BASE_URL=/api`**
This is unique to the frontend build. The React app uses Vite. The API base URL
is baked into the JavaScript bundle at build time. In Kubernetes, the browser
sends API requests through the NGINX Ingress path `/api`, so the frontend must
be built with `/api` as the URL, not `http://localhost:5050/api` which was used
for Docker Compose.

The final built images in this stage:
```
ravinmuthukumarane/bff-service:$(Build.BuildId)
ravinmuthukumarane/identity-service:$(Build.BuildId)
ravinmuthukumarane/salary-submission-service:$(Build.BuildId)
nipuniamarasinghe/vote-service:$(Build.BuildId)
nipuniamarasinghe/search-service:$(Build.BuildId)
nipuniamarasinghe/stats-service:$(Build.BuildId)
nipuniamarasinghe/frontend-service:$(Build.BuildId)
```

---

## Stage 2 — DeployToK3d

```yaml
- stage: DeployToK3d
  displayName: Deploy to k3d Kubernetes cluster
  dependsOn: BuildAndPush
  condition: succeeded()
```

**`dependsOn: BuildAndPush`**
This stage does not start until the `BuildAndPush` stage completes. Stages in
Azure Pipelines run sequentially by default when `dependsOn` is set.

**`condition: succeeded()`**
Only run this stage if the previous stage succeeded. If any `docker push` failed,
there is no point deploying — the images that Kubernetes would pull may not exist
or may be broken.

---

### Why a Self-Hosted Agent Is Required

```yaml
pool:
  name: $(selfHostedPoolName)
```

A **Microsoft-hosted agent** is a temporary cloud VM that Azure DevOps spins up,
runs your job on, and destroys. It has no access to your local Azure VM, your
local Docker daemon, or your local k3d cluster.

A **self-hosted agent** is a process you install and run on your own machine. It
connects to Azure DevOps over HTTPS and waits for jobs. When a job arrives, it
runs on the machine where the agent process is running.

In this project, the k3d cluster runs inside Docker on the Azure VM. The only
way for the pipeline to run `kubectl` commands against that cluster is if the
agent runs on the same VM. So: self-hosted agent, installed on the Azure VM,
pointing at the k3d cluster.

**How to start the self-hosted agent:**
```bash
cd ~/cloud_computing_group_cw/myagent
./run.sh
```

The agent stays online until you press Ctrl+C. If the agent is offline when a
pipeline run is triggered, Azure DevOps queues the job and it waits until the
agent comes back online.

**How to set up the agent (if starting fresh):**
```bash
cd ~/cloud_computing_group_cw/myagent
./config.sh
# Enter:
#   Server URL: https://dev.azure.com/w2121674/
#   Authentication type: PAT
#   Agent pool: cw-cc5
#   Agent name: Cloud-CW-deb
#   Work folder: _work
./run.sh
```

A PAT (Personal Access Token) is created in Azure DevOps under User Settings →
Personal Access Tokens. It needs Agent Pools (Read & manage) permission.
If a PAT is exposed in a log or chat message, revoke it immediately in Azure
DevOps and create a new one.

**Tools the VM must have installed** (the agent runs these directly):
- `docker` — accessible without sudo (agent user must be in the `docker` group)
- `kubectl`
- `k3d`
- k3d cluster `cloud-salary-cluster` already running

**Docker group permission:**
If `docker ps` requires sudo on the VM, the agent will fail with:
```
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```
Fix: add the user to the docker group and correct socket permissions:
```bash
sudo usermod -aG docker ravinmuthukumarane
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
newgrp docker
```
This was Issue 1 encountered during development.

---

### The Deploy Script

The entire deploy job is one `script` step. Here is what it does in order.

#### Load the kubeconfig

```bash
mkdir -p "$HOME/.kube"
k3d kubeconfig merge $(k3dClusterName) --kubeconfig-merge-default --kubeconfig-switch-context
kubectl config use-context k3d-$(k3dClusterName)
```

The agent starts with no Kubernetes context — it does not automatically know
where the cluster is. This block:

1. Ensures `~/.kube/` exists
2. Reads the kubeconfig from the k3d cluster named `cloud-salary-cluster` and
   merges it into the default `~/.kube/config`
3. Sets the active context to `k3d-cloud-salary-cluster`

`--kubeconfig-merge-default` is critical. Without it, `k3d kubeconfig merge`
prints the config to a temp file path but does not write it to `~/.kube/config`,
so subsequent `kubectl` commands still fail with "no context". This was Issue 8.

`--kubeconfig-switch-context` automatically sets the merged context as active,
so the `kubectl config use-context` line that follows is technically redundant
but makes the intent explicit.

---

#### Apply namespaces and ConfigMap

```bash
kubectl apply -f k8s/namespaces/app-namespace.yaml
kubectl apply -f k8s/namespaces/data-namespace.yaml
kubectl apply -f k8s/configmaps/app-config.yaml
```

Same logic as the manual deployment — namespaces must exist before anything else,
and ConfigMaps before Deployments. `kubectl apply` is idempotent: if the
namespace or ConfigMap already exists, it updates it; if it doesn't, it creates
it. Safe to run on every pipeline execution.

---

#### Create/update Secrets from services/identity/.env

```bash
get_env_value() {
  file="$1"
  key="$2"
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

JWT_SECRET_FROM_ENV="$(get_env_value services/identity/.env JWT_SECRET)"
POSTGRES_DB_FROM_ENV="$(get_env_value services/identity/.env DB_NAME)"
POSTGRES_USER_FROM_ENV="$(get_env_value services/identity/.env DB_USER)"
POSTGRES_PASSWORD_FROM_ENV="$(get_env_value services/identity/.env DB_PASSWORD)"
```

**Why read from `.env` instead of using the YAML secret files?**
Secrets in `k8s/secrets/*.yaml` contain hardcoded values. Committing real
secrets to Git is a security risk (they are visible to everyone with repo
access). In the pipeline approach, the `.env` file lives on the VM but is
not committed to the repository (it would be in `.gitignore`). The pipeline
reads values at runtime from that file rather than from committed YAML.

**What the `get_env_value` function does:**
- Takes a file path and a key name
- Uses `sed` to extract the value after `KEY=`
- Strips surrounding quotes if present
- Returns the raw value

**The validation check:**
```bash
if [ -z "$JWT_SECRET_FROM_ENV" ] || ...; then
  echo "Missing JWT_SECRET, DB_NAME, DB_USER, or DB_PASSWORD in services/identity/.env"
  exit 1
fi
```

If any required value is empty (missing from the `.env` file), the deploy stage
fails immediately with a clear message rather than silently creating Kubernetes
Secrets with empty values, which would cause all pods to fail to authenticate.

**Creating Secrets with `--dry-run=client -o yaml | kubectl apply -f -`:**
```bash
kubectl create secret generic app-secrets \
  --namespace app \
  --from-literal=JWT_SECRET="$JWT_SECRET_FROM_ENV" \
  --dry-run=client \
  -o yaml | kubectl apply -f -
```

`kubectl create secret` normally errors if the secret already exists. The
pattern here is a common Kubernetes trick:
- `--dry-run=client` makes kubectl generate the YAML without actually creating
  anything
- `-o yaml` outputs that YAML to stdout
- `kubectl apply -f -` reads from stdin and applies it (creates or updates)

This makes the step idempotent — it works whether the secret is new or already
exists from a previous pipeline run.

The three secrets created:

| Secret name      | Namespace | Keys                                         |
|------------------|-----------|----------------------------------------------|
| app-secrets      | app       | JWT_SECRET                                   |
| app-db-secret    | app       | DB_PASSWORD                                  |
| postgres-secret  | data      | POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD |

---

#### Apply PostgreSQL and application manifests

```bash
kubectl apply -f k8s/postgres/postgres-init-configmap.yaml
kubectl apply -f k8s/postgres/postgres-pvc.yaml
kubectl apply -f k8s/postgres/postgres-deployment.yaml
kubectl apply -f k8s/postgres/postgres-service.yaml

kubectl apply -f k8s/identity/
kubectl apply -f k8s/salary-submission/
kubectl apply -f k8s/vote/
kubectl apply -f k8s/search/
kubectl apply -f k8s/stats/
kubectl apply -f k8s/bff/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/app-ingress.yaml
```

Identical ordering to the manual deployment. `kubectl apply` is idempotent so
running this on a cluster that already has all these resources just updates
anything that changed in the YAML files.

**Important note about the postgres init scripts:**
The PostgreSQL Docker image only runs the init SQL scripts from
`/docker-entrypoint-initdb.d/` when the database directory is empty (i.e., the
first time postgres starts with an empty PVC). On all subsequent pipeline runs,
postgres is already initialized and the init scripts are ignored. This is correct
behaviour — you do not want to re-run `CREATE TABLE` on every deploy.

To fully reset the database (destructive — all data lost):
```bash
sudo kubectl delete pvc postgres-pvc -n data
```

---

#### Update deployments to the new image tag

```bash
kubectl set image deployment/bff bff=$(ravinDockerHubNamespace)/bff-service:$(imageTag) -n app
kubectl set image deployment/identity identity=$(ravinDockerHubNamespace)/identity-service:$(imageTag) -n app
kubectl set image deployment/salary-submission salary-submission=$(ravinDockerHubNamespace)/salary-submission-service:$(imageTag) -n app
kubectl set image deployment/vote vote=$(nipuniDockerHubNamespace)/vote-service:$(imageTag) -n app
kubectl set image deployment/search search=$(nipuniDockerHubNamespace)/search-service:$(imageTag) -n app
kubectl set image deployment/stats stats=$(nipuniDockerHubNamespace)/stats-service:$(imageTag) -n app
kubectl set image deployment/frontend frontend=$(nipuniDockerHubNamespace)/frontend-service:$(imageTag) -n app
```

**Why `kubectl set image` instead of just editing the YAML?**
The YAML deployment files in `k8s/*/` contain a fixed image tag (e.g.
`ravinmuthukumarane/bff-service:1.0.3`). The pipeline builds a new tag on every
run (`$(Build.BuildId)`). Rather than editing the YAML files on every run (which
would clutter git history with tag-only commits), `kubectl set image` updates the
running Deployment object in Kubernetes directly with the new tag.

The format is: `kubectl set image deployment/<name> <container-name>=<image>:<tag> -n <namespace>`

The container name (e.g., `bff`, `identity`, `vote`) comes from the `name` field
under `containers:` in each deployment YAML.

After this command, Kubernetes starts a rolling update: it pulls the new image
and gradually replaces old pods with new ones.

---

#### Wait for rollouts

```bash
kubectl rollout status deployment/postgres -n data
kubectl rollout status deployment/identity -n app
kubectl rollout status deployment/salary-submission -n app
kubectl rollout status deployment/vote -n app
kubectl rollout status deployment/search -n app
kubectl rollout status deployment/stats -n app
kubectl rollout status deployment/bff -n app
kubectl rollout status deployment/frontend -n app
```

`kubectl rollout status` blocks until the deployment has finished rolling out (all
pods are running the new image and passing health checks). If a rollout fails
(e.g., the new image crashes on startup), this command exits with a non-zero
status code, which fails the pipeline step.

This means the pipeline only reports success after every service is genuinely
running the new image. Without this, the pipeline would finish while pods were
still pulling images or starting up, giving false confidence.

---

#### Final resource summary

```bash
kubectl get pods -n data
kubectl get pvc -n data
kubectl get pods -n app
kubectl get services -n app
kubectl get ingress -n app
```

These print the cluster state to the pipeline logs. Useful for reviewing what
was deployed without needing to SSH into the VM.

---

## How the Pipeline Differs from the Manual Deployment

| Concern                    | Manual deployment                  | Pipeline                              |
|----------------------------|------------------------------------|---------------------------------------|
| Image tags                 | Fixed (e.g., `1.0.3`)              | `$(Build.BuildId)` — unique per run   |
| Secret values              | Hardcoded in YAML files            | Read from `services/identity/.env`    |
| NGINX Ingress install      | Manual `kubectl apply` with URL    | Not done by pipeline (pre-existing)   |
| Cluster creation           | Manual `k3d cluster create`        | Not done by pipeline (pre-existing)   |
| kubeconfig                 | Already configured on your shell   | Loaded by `k3d kubeconfig merge`      |
| Trigger                    | You run commands when you want     | Automatic on push to main             |
| Docker Hub auth            | `docker login` in your terminal    | Azure DevOps service connections      |

---

## Issues Encountered and How They Were Fixed

### Issue 1 — Docker permission denied

**Error:** `permission denied while trying to connect to the docker API`

**Cause:** The agent user could not access `/var/run/docker.sock`.

**Fix:**
```bash
sudo usermod -aG docker ravinmuthukumarane
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
newgrp docker
```

---

### Issue 2 — Agent pool name mismatch

**Error:** Jobs queued but never started.

**Cause:** The pool name in `azure-pipelines.yml` (`selfHostedPoolName`) did not
match the actual pool name the agent was registered under in Azure DevOps.

**Fix:** The variable was updated to `cw-cc5` to match the registered pool name.

---

### Issue 3 — Docker Hub push authorization failed

**Error:** `push access denied, repository does not exist or may require authorization`

**Cause:** Both Docker Hub logins were done before any pushes. The second login
(`nipuniamarasinghe`) overwrote the first (`ravinmuthukumarane`). Pushing
ravinmuthukumarane images while authenticated as nipuniamarasinghe was rejected.

**Fix:** Restructured to: login ravinmuthukumarane → push ravinmuthukumarane
images → login nipuniamarasinghe → push nipuniamarasinghe images.

---

### Issue 4 — Kubernetes current-context not set

**Error:** `error: current-context is not set`

**Cause:** The self-hosted agent had no `~/.kube/config`. Kubernetes context was
only configured in the interactive shell session, not in the agent's environment.

**Fix:** Added to the deploy script:
```bash
mkdir -p "$HOME/.kube"
k3d kubeconfig merge cloud-salary-cluster --kubeconfig-merge-default --kubeconfig-switch-context
kubectl config use-context k3d-cloud-salary-cluster
```

---

### Issue 5 — k3d context not found after kubeconfig merge

**Error:** `error: no context exists with the name: "k3d-cloud-salary-cluster"`

**Cause:** Running `k3d kubeconfig merge` without `--kubeconfig-merge-default`
only printed the config to a temp file path; it did not write into `~/.kube/config`.

**Fix:** Added `--kubeconfig-merge-default` to the merge command.

---

### Issue 6 — Azure DevOps agent session revoked

**Error:** `Failed to create session. VS30063: You are not authorized to access https://dev.azure.com`

**Cause:** The agent's stored PAT became invalid (expired, rotated, or revoked).

**Fix:** Reconfigure the agent with a new PAT:
```bash
cd ~/cloud_computing_group_cw/myagent
./config.sh remove
./config.sh
./run.sh
```

---

### Issue 7 — Service connection authorization required

**Behavior:** First pipeline run paused at the Docker login step with an
authorization prompt.

**Cause:** Azure DevOps requires explicit authorization the first time a pipeline
uses a service connection.

**Fix:** Approved the service connections for the pipeline in the Azure DevOps
pipeline run UI. This is a one-time step per service connection per pipeline.

---

### Issue 8 — Trigger section misunderstood

**Error:** YAML validation error — tasks placed inside the `trigger` block.

**Cause:** Misunderstanding of YAML structure: `trigger` only controls when the
pipeline fires; it cannot contain Docker login tasks.

**Fix:** Docker login tasks remain under `stages → jobs → steps`. The trigger
section only contains branch filter configuration.

---

## Checking Pipeline Results

After a push to `main`, go to Azure DevOps → Pipelines → the most recent run.
You will see two stages: `Build and push Docker images` and
`Deploy to k3d Kubernetes cluster`.

Click any step to see its log output. The deploy step prints
`kubectl get pods -n app` at the end — this shows whether all pods are Running
with the new image tag.

From the VM after a successful pipeline run:
```bash
curl http://localhost:8080/
curl http://localhost:8080/api/search
curl http://localhost:8080/api/stats
```

From a browser: `http://<VM_PUBLIC_IP>:8080/`

---

## Quick Reference — What You Need Before Running the Pipeline

| Prerequisite                              | Where to set it up                          |
|-------------------------------------------|---------------------------------------------|
| k3d cluster `cloud-salary-cluster` running | See k3d-learning-journey.md                 |
| NGINX Ingress installed on the cluster    | See k3d-learning-journey.md                 |
| Self-hosted agent running (`./run.sh`)    | `~/cloud_computing_group_cw/myagent/`       |
| Agent in pool `cw-cc5`                    | Azure DevOps → Project Settings → Pools     |
| Service connection `dockerhub-ravinmuthukumarane` | Azure DevOps → Service connections  |
| Service connection `dockerhub-nipuniamarasinghe`  | Azure DevOps → Service connections  |
| `services/identity/.env` exists on the VM with JWT_SECRET, DB_NAME, DB_USER, DB_PASSWORD | On the VM |
| Agent user has Docker access without sudo | `sudo usermod -aG docker <user>`            |

---

## The `.env` File Expected by the Pipeline

The pipeline reads from `services/identity/.env`. This file must exist on the
VM (it is not committed to Git). It must contain at minimum:

```
JWT_SECRET=coursework-local-secret
DB_NAME=cloud_salary
DB_USER=postgres
DB_PASSWORD=65610
```

These values become the Kubernetes Secrets deployed to the cluster. If any value
is missing, the deploy stage fails with a clear error before touching Kubernetes.
