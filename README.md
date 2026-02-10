# SaaS-Sentinel

SaaS-Sentinel is a smart proxy layer designed to monitor API usage, inject credentials securely, and log time-series metrics to prevent overspending. It acts as a middleware between your application and external services (like OpenAI, Stripe, etc.).

## 📂 Project Structure

Here is an overview of the key files and directories in the project:

```
SaaS-Sentinel/
├── src/
│   ├── middleware/
│   │   └── proxy.middleware.ts  # invalidates requests, injects API keys, and logs metrics
│   ├── services/
│   │   └── metrics.service.ts   # Handles database interactions for storing API usage metrics
│   ├── server.ts                # Main entry point, sets up Express app and routes
│   └── test-proxy.ts            # Script to simulate API calls and test the proxy behavior
├── prisma/
│   ├── schema.prisma            # Database schema definition for Prisma (SQLite)
│   └── dev.db                   # SQLite database file (generated after db push)
├── .env                         # Environment variables (API keys, DB URL, Port)
├── IMPLEMENTATION_SUMMARY.md    # Summary of implemented features and architecture
├── PREREQUISITES.md             # Guide on system requirements and installation
├── package.json                 # Project dependencies and scripts
└── tsconfig.json                # TypeScript configuration
```

## 🚀 Key Components

### 1. `src/server.ts`
The main application file. It:
- Initializes the Express server.
- Sets up the `/health` and `/metrics` endpoints.
- Applies the proxy middleware to route requests.

### 2. `src/middleware/proxy.middleware.ts`
The core logic of the sentinel. It:
- Intercepts incoming requests to `/proxy/...`.
- Injects the appropriate API key based on the service name.
- Measures the duration of the request.
- Logs the request cost and status to the database.

### 3. `src/services/metrics.service.ts`
A service class that abstracts database operations. It:
- Connects to the SQLite database using Prisma.
- format and saves `ApiMetric` records.
- Calculates costs based on usage (mock implementation for now).

### 4. `prisma/schema.prisma`
Defines the data model. It currently includes the `ApiMetric` model to store details like timestamp, service name, endpoint, latency, and cost.

## 🛠️ Setup & Usage

Please refer to [PREREQUISITES.md](./PREREQUISITES.md) for detailed installation instructions.

To start the server:
```bash
npm run dev
```

To run the test script:
```bash
npx ts-node src/test-proxy.ts
```
