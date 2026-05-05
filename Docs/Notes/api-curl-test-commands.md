# API curl Test Commands

Use one base URL depending on where the application is running.

For local BFF testing:

```bash
BASE_URL="http://localhost:5000"
```

For Kubernetes/k3d through ingress on the VM:

```bash
BASE_URL="http://localhost:8080"
```

For Azure VM public access:

```bash
BASE_URL="http://VM_PUBLIC_IP:8080"
```

Replace `VM_PUBLIC_IP` with the VM public IP address.

---

## 1. BFF Health Check

```bash
curl -i "$BASE_URL/health"
```

---

## 2. Sign Up

Use a new email each time, because duplicate emails return `409`.

```bash
curl -i -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@example.com",
    "password": "StrongPassword123"
  }'
```

---

## 3. Login

```bash
curl -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@example.com",
    "password": "StrongPassword123"
  }'
```

Copy the returned JWT token and set it as:

```bash
TOKEN="PASTE_JWT_TOKEN_HERE"
```

---

## 4. Submit Salary

```bash
curl -i -X POST "$BASE_URL/api/salaries" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "Sri Lanka",
    "company": "WSO2",
    "role": "Software Engineer",
    "experienceLevel": "Mid",
    "salaryAmount": 350000,
    "currency": "LKR",
    "anonymize": true
  }'
```

Copy the returned `submissionId` and set it as:

```bash
SUBMISSION_ID="PASTE_SUBMISSION_ID_HERE"
```

---

## 5. List Salary Submissions

This is useful for finding a `PENDING` submission ID before voting.

```bash
curl -i "$BASE_URL/api/submissions"
```

Filter by pending status:

```bash
curl -i "$BASE_URL/api/submissions?status=PENDING"
```

---

## 6. Vote on a Submission

This endpoint requires a JWT token.

```bash
curl -i -X POST "$BASE_URL/api/votes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"submissionId\": \"$SUBMISSION_ID\",
    \"voteType\": \"UPVOTE\"
  }"
```

Note: the same user can vote only once for the same submission. To reach the approval threshold, create and log in as different users, then vote with each user's token.

---

## 7. Search Approved Salaries

Search all approved salaries:

```bash
curl -i "$BASE_URL/api/search"
```

Search with filters:

```bash
curl -i "$BASE_URL/api/search?country=Sri%20Lanka&role=Software%20Engineer"
```

---

## 8. Get Salary Statistics

Get all approved salary statistics:

```bash
curl -i "$BASE_URL/api/stats"
```

Get filtered statistics:

```bash
curl -i "$BASE_URL/api/stats?country=Sri%20Lanka&role=Software%20Engineer"
```

---

## 9. Service Health Checks for Local Development

These direct service checks are for local development only. In Kubernetes, external access should go through the BFF and ingress.

```bash
curl -i "http://localhost:5001/health"
curl -i "http://localhost:5002/health"
curl -i "http://localhost:5003/health"
curl -i "http://localhost:5004/health"
curl -i "http://localhost:5005/health"
```
