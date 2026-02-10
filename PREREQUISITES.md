# SaaS-Sentinel Prerequisites

To run SaaS-Sentinel locally, ensure you have the following installed and configured.

## 1. System Requirements
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **OS**: Windows, macOS, or Linux

## 2. Core Dependencies
Run the following command to install all necessary packages:

```bash
npm install express http-proxy-middleware dotenv zod axios
```

## 3. Database & ORM
SaaS-Sentinel uses Prisma with SQLite for time-series metrics storage.

```bash
# Install Prisma CLI and Client
npm install prisma@5.14.0 @prisma/client@5.14.0
```

## 4. Development Tools
- **TypeScript**: For type safety.
- **ts-node**: To run TypeScript files directly.

```bash
npm install --save-dev typescript ts-node @types/express @types/node @types/dotenv
```

## 5. Database Initialization
After installing the dependencies, initialize the SQLite database:

```bash
npx prisma db push
```

## 6. Environment Configuration
Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
PORT=3000

# Add your API keys here
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
STRIPE_API_KEY=your_stripe_key
```
