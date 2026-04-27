# Kubernetes and Cloud Architecture Mermaid Diagrams

This document contains Mermaid diagrams for the Cloud Salary Transparency System Kubernetes deployment.

The diagrams are written so they can be copied into Markdown viewers that support Mermaid, GitHub, Mermaid Live Editor, or report tooling.

---

## 1. High-Level Cloud-Native Architecture

```mermaid
flowchart TB
    user[User Browser]
    azure[Azure VM Public IP:8080]
    k3d[k3d Single-Node Kubernetes Cluster]
    ingress[NGINX Ingress Controller]
    frontend[Frontend Service<br/>Serves React UI and static assets]
    bff[BFF Service<br/>Only browser API entry point]
    identity[Identity Service]
    salary[Salary Submission Service]
    vote[Vote Service]
    search[Search Service]
    stats[Stats Service]
    postgres[(PostgreSQL<br/>Persistent Storage)]

    user --> azure
    azure --> k3d
    k3d --> ingress
    ingress -->|Browser requests / and /assets/*| frontend
    user -. Frontend JS calls /api/* .-> ingress
    ingress -->|Only /api/* routes here| bff

    bff --> identity
    bff --> salary
    bff --> vote
    bff --> search
    bff --> stats

    identity --> postgres
    salary --> postgres
    vote --> postgres
    search --> postgres
    stats --> postgres
```

---

## 2. Kubernetes Namespace Diagram

```mermaid
flowchart TB
    subgraph cluster[k3d Kubernetes Cluster]
        subgraph ingressns[Namespace: ingress-nginx]
            nginx[NGINX Ingress Controller Pod]
        end

        subgraph appns[Namespace: app]
            frontend[frontend pod]
            bff[bff pod]
            identity[identity pod]
            salary[salary-submission pod]
            vote[vote pod]
            search[search pod]
            stats[stats pod]

            fsvc[frontend-service]
            bffsvc[bff-service]
            idsvc[identity-service]
            salarysvc[salary-submission-service]
            votesvc[vote-service]
            searchsvc[search-service]
            statssvc[stats-service]
        end

        subgraph datans[Namespace: data]
            postgres[postgres pod]
            pgsvc[postgres service]
            pvc[postgres-pvc]
        end
    end

    nginx -->|Path / and static assets| fsvc
    nginx -->|Path /api/* only| bffsvc

    fsvc --> frontend
    bffsvc --> bff
    idsvc --> identity
    salarysvc --> salary
    votesvc --> vote
    searchsvc --> search
    statssvc --> stats

    identity --> pgsvc
    salary --> pgsvc
    vote --> pgsvc
    search --> pgsvc
    stats --> pgsvc

    pgsvc --> postgres
    postgres --> pvc
```

---

## 3. Ingress and Network Routing Diagram

```mermaid
flowchart LR
    browser[Browser]
    vm[Azure VM<br/>Public IP]
    firewall[Azure NSG / Firewall<br/>Allow TCP 8080]
    k3dlb[k3d Load Balancer<br/>Host 8080 -> Cluster 80]
    nginx[NGINX Ingress]
    frontend[frontend-service:80<br/>UI and static files]
    bff[bff-service:5050<br/>Browser API entry point]

    browser -->|http://VM_PUBLIC_IP:8080| vm
    vm --> firewall
    firewall --> k3dlb
    k3dlb --> nginx
    nginx -->|Path / and /assets/*| frontend
    browser -. JavaScript fetch /api/* .-> nginx
    nginx -->|Path /api/*| bff
```

---

## 4. Service-to-Pod Mapping Diagram

```mermaid
flowchart TB
    subgraph app[app namespace]
        frontendSvc[frontend-service<br/>ClusterIP :80]
        bffSvc[bff-service<br/>ClusterIP :5050]
        identitySvc[identity-service<br/>ClusterIP :5001]
        salarySvc[salary-submission-service<br/>ClusterIP :5002]
        voteSvc[vote-service<br/>ClusterIP :5003]
        searchSvc[search-service<br/>ClusterIP :5004]
        statsSvc[stats-service<br/>ClusterIP :5005]

        frontendPod[frontend pod<br/>label app=frontend]
        bffPod[bff pod<br/>label app=bff]
        identityPod[identity pod<br/>label app=identity]
        salaryPod[salary-submission pod<br/>label app=salary-submission]
        votePod[vote pod<br/>label app=vote]
        searchPod[search pod<br/>label app=search]
        statsPod[stats pod<br/>label app=stats]
    end

    frontendSvc -->|selector app=frontend| frontendPod
    bffSvc -->|selector app=bff| bffPod
    identitySvc -->|selector app=identity| identityPod
    salarySvc -->|selector app=salary-submission| salaryPod
    voteSvc -->|selector app=vote| votePod
    searchSvc -->|selector app=search| searchPod
    statsSvc -->|selector app=stats| statsPod
```

---

## 5. Pod Count Diagram

```mermaid
flowchart TB
    subgraph coursework[Coursework Workload Pods]
        subgraph app[app namespace - 7 pods]
            frontend[frontend]
            bff[bff]
            identity[identity]
            salary[salary-submission]
            vote[vote]
            search[search]
            stats[stats]
        end

        subgraph data[data namespace - 1 pod]
            postgres[postgres]
        end
    end

    total[Total coursework pods: 8]

    frontend --> total
    bff --> total
    identity --> total
    salary --> total
    vote --> total
    search --> total
    stats --> total
    postgres --> total
```

---

## 6. Labels and Selectors Diagram

```mermaid
flowchart LR
    svc[Service]
    selector[selector<br/>app=service-name]
    pod[Pod]
    label[label<br/>app=service-name]

    svc --> selector
    selector --> label
    label --> pod

    example1[Example:<br/>bff-service]
    example2[selector app=bff]
    example3[bff pod<br/>label app=bff]

    example1 --> example2
    example2 --> example3
```

---

## 7. API Request Flow Diagram

```mermaid
sequenceDiagram
    participant U as User Browser
    participant I as NGINX Ingress
    participant F as Frontend
    participant B as BFF
    participant S as Internal Service
    participant DB as PostgreSQL

    U->>I: GET /
    I->>F: Route to frontend-service
    F-->>U: React app HTML/CSS/JS

    U->>I: GET /api/search
    I->>B: Route to bff-service
    B->>S: GET /search on search-service
    S->>DB: Query approved salaries
    DB-->>S: Results
    S-->>B: JSON results
    B-->>I: JSON response
    I-->>U: JSON response
```

---

## 8. Salary Submission Workflow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BFF as BFF
    participant Salary as Salary Submission Service
    participant Identity as Identity Service
    participant Vote as Vote Service
    participant Search as Search Service
    participant Stats as Stats Service
    participant DB as PostgreSQL

    U->>FE: Submit salary anonymously
    FE->>BFF: POST /api/salaries
    BFF->>Salary: POST /submissions
    Salary->>DB: Insert salary with PENDING status
    DB-->>Salary: submissionId
    Salary-->>BFF: Created response
    BFF-->>FE: Created response

    U->>FE: Sign up / log in
    FE->>BFF: POST /api/auth/login
    BFF->>Identity: POST /login
    Identity->>DB: Validate user credentials
    Identity-->>BFF: JWT token
    BFF-->>FE: JWT token

    U->>FE: Vote on submission
    FE->>BFF: POST /api/votes with JWT
    BFF->>BFF: Verify JWT
    BFF->>Vote: POST /votes
    Vote->>DB: Insert vote
    Vote->>DB: Count upvotes
    Vote->>DB: Update status to APPROVED if threshold reached
    Vote-->>BFF: Vote result
    BFF-->>FE: Vote result

    U->>FE: Search approved salaries
    FE->>BFF: GET /api/search
    BFF->>Search: GET /search
    Search->>DB: Query APPROVED submissions
    Search-->>BFF: Results
    BFF-->>FE: Results

    U->>FE: View stats
    FE->>BFF: GET /api/stats
    BFF->>Stats: GET /stats
    Stats->>DB: Aggregate APPROVED submissions
    Stats-->>BFF: Stats
    BFF-->>FE: Stats
```

---

## 9. Database Schema Diagram

```mermaid
erDiagram
    IDENTITY_USERS {
        uuid id PK
        varchar email UK
        text password_hash
        timestamp created_at
        timestamp updated_at
    }

    SALARY_SUBMISSIONS {
        uuid id PK
        varchar country
        varchar company
        varchar role
        varchar experience_level
        numeric salary_amount
        varchar currency
        boolean anonymize
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    COMMUNITY_VOTES {
        uuid id PK
        uuid submission_id FK
        uuid user_id FK
        varchar vote_type
        timestamp created_at
    }

    COMMUNITY_REPORTS {
        uuid id PK
        uuid submission_id FK
        uuid user_id FK
        text reason
        timestamp created_at
    }

    IDENTITY_USERS ||--o{ COMMUNITY_VOTES : casts
    SALARY_SUBMISSIONS ||--o{ COMMUNITY_VOTES : receives
    IDENTITY_USERS ||--o{ COMMUNITY_REPORTS : creates
    SALARY_SUBMISSIONS ||--o{ COMMUNITY_REPORTS : receives
```

---

## 10. PostgreSQL Storage Diagram

```mermaid
flowchart TB
    subgraph data[data namespace]
        deploy[postgres Deployment]
        pod[postgres pod]
        pvc[postgres-pvc<br/>ReadWriteOnce 1Gi]
        pv[local-path PersistentVolume]
        svc[postgres Service<br/>ClusterIP :5432]
        init[postgres-init-sql ConfigMap<br/>001 schemas<br/>002 tables<br/>003 indexes]
    end

    deploy --> pod
    svc --> pod
    pod --> pvc
    pvc --> pv
    init -->|mounted to /docker-entrypoint-initdb.d| pod
```

---

## 11. ConfigMap and Secret Wiring Diagram

```mermaid
flowchart TB
    appConfig[app-config ConfigMap<br/>DB_HOST<br/>DB_PORT<br/>DB_NAME<br/>DB_USER<br/>SERVICE_URLS]
    appSecrets[app-secrets Secret<br/>JWT_SECRET]
    appDbSecret[app-db-secret Secret<br/>DB_PASSWORD]
    postgresSecret[postgres-secret Secret<br/>POSTGRES_DB<br/>POSTGRES_USER<br/>POSTGRES_PASSWORD]

    bff[BFF Deployment]
    identity[Identity Deployment]
    salary[Salary Deployment]
    vote[Vote Deployment]
    search[Search Deployment]
    stats[Stats Deployment]
    postgres[Postgres Deployment]

    appConfig --> bff
    appSecrets --> bff

    appConfig --> identity
    appSecrets --> identity
    appDbSecret --> identity

    appConfig --> salary
    appDbSecret --> salary

    appConfig --> vote
    appDbSecret --> vote

    appConfig --> search
    appDbSecret --> search

    appConfig --> stats
    appDbSecret --> stats

    postgresSecret --> postgres
```

---

## 12. Docker Image Ownership Diagram

```mermaid
flowchart TB
    subgraph ravin[Docker Hub: ravinmuthukumarane]
        bffImg[ravinmuthukumarane/bff-service:1.0.0]
        identityImg[ravinmuthukumarane/identity-service:1.0.0]
        salaryImg[ravinmuthukumarane/salary-submission-service:1.0.0]
    end

    subgraph nipuni[Docker Hub: nipuniamarasinghe]
        voteImg[nipuniamarasinghe/vote-service:1.0.0]
        searchImg[nipuniamarasinghe/search-service:1.0.0]
        statsImg[nipuniamarasinghe/stats-service:1.0.0]
        frontendImg[nipuniamarasinghe/frontend-service:1.0.1]
    end

    subgraph k8s[Kubernetes Deployments]
        bff[bff]
        identity[identity]
        salary[salary-submission]
        vote[vote]
        search[search]
        stats[stats]
        frontend[frontend]
    end

    bffImg --> bff
    identityImg --> identity
    salaryImg --> salary
    voteImg --> vote
    searchImg --> search
    statsImg --> stats
    frontendImg --> frontend
```

---

## 13. Azure Pipeline CI/CD Diagram

```mermaid
flowchart LR
    repo[Git Repository]
    pipeline[Azure Pipeline]
    build[Build Docker Images]
    push[Push to Docker Hub]
    agent[Self-hosted Agent<br/>on Azure VM]
    k3d[k3d Cluster]
    deploy[kubectl apply<br/>kubectl set image]
    app[Running Application]

    repo --> pipeline
    pipeline --> build
    build --> push
    pipeline --> agent
    agent --> deploy
    deploy --> k3d
    k3d --> app
```

---

## 14. Azure Pipeline Stage Diagram

```mermaid
flowchart TB
    trigger[Push to main branch]

    subgraph stage1[Stage 1: BuildAndPush]
        checkout1[Checkout repo]
        login1[Login Docker Hub<br/>ravinmuthukumarane]
        login2[Login Docker Hub<br/>nipuniamarasinghe]
        buildImages[Build all Docker images]
        pushImages[Push images with Build ID tag]
    end

    subgraph stage2[Stage 2: DeployToK3d]
        checkout2[Checkout repo on self-hosted VM agent]
        applyNs[Apply namespaces]
        applyConfig[Apply ConfigMaps]
        createSecrets[Create Secrets from Azure secret variables]
        applyDb[Apply PostgreSQL manifests]
        applyApps[Apply app manifests]
        setImages[kubectl set image to Build ID tag]
        waitRollout[Wait for rollouts]
        summary[Print Kubernetes resource summary]
    end

    trigger --> checkout1
    checkout1 --> login1
    login1 --> login2
    login2 --> buildImages
    buildImages --> pushImages
    pushImages --> checkout2
    checkout2 --> applyNs
    applyNs --> applyConfig
    applyConfig --> createSecrets
    createSecrets --> applyDb
    applyDb --> applyApps
    applyApps --> setImages
    setImages --> waitRollout
    waitRollout --> summary
```

---

## 15. Final Evidence Checklist Diagram

```mermaid
flowchart TB
    evidence[Coursework Evidence]

    cluster[kubectl get nodes]
    namespaces[kubectl get namespaces]
    appPods[kubectl get pods -n app]
    dataPods[kubectl get pods -n data]
    services[kubectl get svc -n app]
    ingress[kubectl get ingress -n app]
    pvc[kubectl get pvc -n data]
    db[psql schemas/tables/indexes]
    browser[Browser screenshot<br/>VM_PUBLIC_IP:8080]
    api[curl /api/search<br/>curl /api/stats]
    pipeline[Azure Pipeline run logs]

    evidence --> cluster
    evidence --> namespaces
    evidence --> appPods
    evidence --> dataPods
    evidence --> services
    evidence --> ingress
    evidence --> pvc
    evidence --> db
    evidence --> browser
    evidence --> api
    evidence --> pipeline
```
