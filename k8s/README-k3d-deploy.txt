Manual k3d Kubernetes deployment guide
======================================

Important
---------

These commands are for you to run manually in the terminal.
Codex should not run them automatically.

The Kubernetes manifests are arranged under:

k8s/

Namespaces:

app  - frontend and backend application services
data - PostgreSQL and database storage


Image ownership used in Kubernetes manifests
--------------------------------------------

Images from nipuniamarasinghe:

nipuniamarasinghe/vote-service:1.0.0
nipuniamarasinghe/search-service:1.0.0
nipuniamarasinghe/stats-service:1.0.0
nipuniamarasinghe/frontend-service:1.0.0

Images from ravinmuthukumarane:

ravinmuthukumarane/bff-service:1.0.0
ravinmuthukumarane/identity-service:1.0.0
ravinmuthukumarane/salary-submission-service:1.0.0


Before applying manifests
-------------------------

Edit these files and replace placeholder secrets:

k8s/secrets/app-secrets.yaml
k8s/secrets/postgres-secret.yaml

Current placeholders:

replace_with_strong_jwt_secret
replace_with_postgres_password

For local coursework testing, the values should match what the application
expects. The old local Docker value was:

JWT secret: coursework-local-secret
Postgres password: 65610

Do not commit real production secrets.


Step 1 - Create k3d cluster
---------------------------

Command:

k3d cluster create cloud-salary-cluster \
  --servers 1 \
  --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer"

What it does:

Creates a single-node k3d cluster and maps the cluster load balancer HTTP port
to localhost:8080 on the VM.

Expected result:

k3d reports that the cluster was created successfully.


Step 2 - Install NGINX Ingress
------------------------------

Command:

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

What it does:

Installs the NGINX Ingress Controller.

Expected result:

Kubernetes creates ingress-nginx resources.


Step 3 - Wait for NGINX Ingress
-------------------------------

Command:

kubectl get pods -n ingress-nginx

What it does:

Shows ingress controller pods.

Expected result:

The ingress-nginx-controller pod should eventually be Running.


Step 4 - Create namespaces
--------------------------

Command:

kubectl apply -f k8s/namespaces/app-namespace.yaml
kubectl apply -f k8s/namespaces/data-namespace.yaml

What it does:

Creates the app and data namespaces.

Expected result:

namespace/app created
namespace/data created


Step 5 - Apply ConfigMaps and Secrets
-------------------------------------

Command:

kubectl apply -f k8s/configmaps/app-config.yaml
kubectl apply -f k8s/secrets/app-secrets.yaml
kubectl apply -f k8s/secrets/postgres-secret.yaml

What it does:

Creates application config and secret values.

Expected result:

configmap/app-config created
secret/app-secrets created
secret/postgres-secret created


Step 6 - Deploy PostgreSQL
--------------------------

Command:

kubectl apply -f k8s/postgres/postgres-init-configmap.yaml
kubectl apply -f k8s/postgres/postgres-pvc.yaml
kubectl apply -f k8s/postgres/postgres-deployment.yaml
kubectl apply -f k8s/postgres/postgres-service.yaml

What it does:

Creates the PostgreSQL init SQL ConfigMap, persistent storage, Deployment, and
ClusterIP Service.

Expected result:

configmap/postgres-init-sql created
persistentvolumeclaim/postgres-pvc created
deployment.apps/postgres created
service/postgres created


Step 7 - Check PostgreSQL
-------------------------

Command:

kubectl get pods -n data
kubectl get pvc -n data

What it does:

Shows the PostgreSQL pod and persistent volume claim.

Expected result:

postgres pod should become Running.
postgres-pvc should become Bound.


Step 8 - Deploy backend services
--------------------------------

Command:

kubectl apply -f k8s/identity/
kubectl apply -f k8s/salary-submission/
kubectl apply -f k8s/vote/
kubectl apply -f k8s/search/
kubectl apply -f k8s/stats/
kubectl apply -f k8s/bff/

What it does:

Creates Deployments and ClusterIP Services for all backend services.

Expected result:

Each command should create one Deployment and one Service.


Step 9 - Deploy frontend
------------------------

Command:

kubectl apply -f k8s/frontend/

What it does:

Creates frontend Deployment and ClusterIP Service.

Expected result:

deployment.apps/frontend created
service/frontend-service created


Step 10 - Deploy ingress
------------------------

Command:

kubectl apply -f k8s/ingress/app-ingress.yaml

What it does:

Creates ingress routing:

/      -> frontend-service
/api   -> bff-service

Expected result:

ingress.networking.k8s.io/app-ingress created


Step 11 - Check app resources
-----------------------------

Command:

kubectl get pods -n app
kubectl get services -n app
kubectl get ingress -n app

What it does:

Shows app pods, services, and ingress.

Expected result:

All app pods should become Running.
Services should be ClusterIP.
Ingress should be visible.


Step 12 - Open the app
----------------------

Command:

curl http://localhost:8080/

What it does:

Requests the frontend through ingress.

Expected result:

HTML from the frontend should be returned.

Browser URL:

http://VM_PUBLIC_IP:8080/


Step 13 - Test BFF health through ingress
-----------------------------------------

Command:

curl http://localhost:8080/api/health

What it does:

Routes /api/health through ingress to the BFF service.

Expected result:

{"status":"ok","service":"bff"}


Important SQL init note
-----------------------

PostgreSQL only runs /docker-entrypoint-initdb.d scripts when the database data
directory is empty.

If you need to rerun the SQL init scripts from scratch, delete the PostgreSQL
PVC and redeploy Postgres. This deletes database data.

Command:

kubectl delete pvc postgres-pvc -n data

Only run that when you intentionally want a fresh database.

