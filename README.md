# RelayX - Distributed Job Processing Platform

RelayX is a production-style backend background job processing engine built with **Node.js, Express, TypeScript, PostgreSQL, and Next.js**. 

It demonstrates how PostgreSQL row-level locking (`SELECT FOR UPDATE SKIP LOCKED`) can power a durable, ACID-safe distributed job queue with automatic retries, dead-letter queues, and interactive real-time visualization.

---

## 🚀 Key Features

- **PostgreSQL Queue Engine** — Submit jobs with type, arbitrary JSON payload, delay seconds, or timestamp execution (`available_at`).
- **Atomic Row Lock Claiming** — Concurrent workers safely claim pending jobs using `SELECT FOR UPDATE SKIP LOCKED` (zero lock contention or duplicate execution).
- **High-Throughput Concurrency** — Configurable parallel worker processing limit (`WORKER_CONCURRENCY`).
- **Exponential Backoff & Retries** — Failed jobs retry automatically with growing delays + randomized jitter to prevent thundering herd problems.
- **Dead Letter Queue (DLQ)** — Poison-pill jobs exhausting max retries transition to DLQ with full stack trace preservation and 1-click retry API.
- **Strict Idempotency** — Unique `idempotency_key` constraints prevent duplicate job creation upon network retries.
- **Interactive Next.js Dashboard** — Modern real-time UI featuring a live job queue inspector, interactive API playground, telemetry metrics, and DLQ controls.
- **Graceful SIGINT Draining** — Workers intercept shutdown signals, block new row claims, and drain active in-flight jobs before terminating.

---

## 🏗️ Architecture Overview

```
                      ┌─────────────────────────────────────────┐
    POST /api/jobs    │             Express API                 │    GET /api/stats
   ──────────────────▶│          (Backend Port: 5000)         │◀──────────────────
                      └────────────────────┬────────────────────┘
                                           │ INSERT
                                           ▼
                                  ┌─────────────────┐
                                  │   PostgreSQL    │
                                  │   jobs table    │
                                  │  ┌───────────┐  │
                                  │  │  pending  │  │
                                  │  │ processing│  │
                                  │  │ completed │  │
                                  │  │dead_letter│  │
                                  │  └───────────┘  │
                                  └────────┬────────┘
                                           │ SELECT FOR UPDATE SKIP LOCKED
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                          Worker 1     Worker 2     Worker N
                        (stateless worker nodes polling PostgreSQL)
```

---

## ⚙️ Port Configuration

| Service | Host URL | Description |
|---|---|---|
| **Backend Express API** | `http://localhost:5000` | REST API Server (`PORT=5000`) |
| **Frontend Dashboard** | `http://localhost:3000` | Next.js Interactive Dashboard |
| **PostgreSQL Database** | `localhost:5432` | Storage Engine |

---

## 🛠️ Quick Start (Local Development)

### 1. Backend Server Setup (`port: 5000`)

```bash
# Navigate to server directory
cd server

# Install backend dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Start Postgres database (or use local PostgreSQL)
docker-compose up postgres -d

# Run database migrations
npm run migrate

# Start Express API Server (Terminal 1)
npm run dev

# Start Background Worker Process (Terminal 2)
npm run worker
```

### 2. Frontend Client Setup (`port: 3000`)

```bash
# Navigate to client directory
cd client

# Install client dependencies
npm install

# Copy environment setup
cp .env.example .env.local

# Start Next.js Development Server (Terminal 3)
npm run dev
```

Open `http://localhost:3000` in your browser to view the interactive RelayX console and live queue state.

---

## 🐳 Docker Deployment

To spin up the entire infrastructure via Docker Compose:

```bash
docker-compose up --build
```

---

## 📜 REST API Reference

### Jobs API (`http://localhost:5000/api/jobs`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs` | Enqueue a new background job |
| `GET` | `/api/jobs` | List queue jobs (filterable by status, paginated) |
| `GET` | `/api/jobs/:id` | Fetch single job metadata by ID |

#### Dispatch Job Example:

```http
POST /api/jobs
Content-Type: application/json

{
  "type": "send_email",
  "payload": { "to": "user@example.com" },
  "max_attempts": 3,
  "delay_seconds": 10,
  "idempotency_key": "unique_tx_109283"
}
```

### Dead Letter Queue (DLQ) API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dead-letter` | List all dead-lettered jobs |
| `POST` | `/api/dead-letter/:id/retry` | Re-queue a DLQ job (resets attempts to 0) |
| `DELETE` | `/api/dead-letter/:id` | Permanently discard a DLQ job |

### Telemetry & Stats

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Queue metrics, active counts, and throughput |
| `GET` | `/health` | Server health check |

---

## 📄 License & Author

Created by [Shobhit070304](https.github.com/Shobhit070304). Open-source under the MIT License.