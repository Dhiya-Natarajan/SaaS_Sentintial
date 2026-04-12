import assert from 'node:assert/strict';
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams
} from 'node:child_process';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const TEST_DB_BASENAME = 'test-proxy.db';
const TEST_DB_PATH = path.join(process.cwd(), 'prisma', TEST_DB_BASENAME);
const PRISMA_SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');
const USAGE_MODEL_PATH = path.join(process.cwd(), 'ml_models', 'usage-model.json');
const DETERMINISTIC_USAGE_THRESHOLD = 3.5;
const OPENAI_BURST_REQUEST_COUNT = 12;

interface HealthResponse {
  status: string;
  monitoredServices: string[];
  usageModelStatus: string;
}

interface PricingRulesResponse {
  count: number;
  rules: Array<{
    service: string;
    flatRate: number;
    currency: string;
  }>;
}

interface MetricsResponse {
  totalCalls: number;
  breakdown: Array<{
    service: string;
    calls: number;
    totalLatency: number;
    totalCost: number;
  }>;
}

interface SummaryResponse {
  totalRequests: number;
  totalCost: number;
}

interface BlockedResponse {
  error: string;
  reason: string;
  actions: string[];
}

interface TestDatabaseConfig {
  provider: string;
  databaseUrl: string;
  cleanup: () => void;
}

interface TestRunOptions {
  backendPort?: number;
  holdOpen: boolean;
  dashboardMode: boolean;
}

interface MockRequestRecord {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

interface EnforcementLogEntry {
  service: string;
  routedService: string;
  severity: string;
  action: string;
  currentUsage?: number | null;
  details?: string | null;
}

interface EnforcementResponse {
  count: number;
  logs: EnforcementLogEntry[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomPortStart(min = 20000, max = 50000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseInteger(input: string | undefined) {
  if (!input) {
    return undefined;
  }

  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function readFlagValue(args: string[], flagName: string) {
  const prefix = `${flagName}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function parseRunOptions(args: string[]): TestRunOptions {
  const dashboardMode = args.includes('--dashboard');
  const backendPort =
    parseInteger(readFlagValue(args, '--backend-port')) ||
    parseInteger(process.env.TEST_BACKEND_PORT) ||
    (dashboardMode ? 3001 : undefined);
  const holdOpen =
    dashboardMode ||
    args.includes('--hold-open') ||
    process.env.TEST_KEEP_BACKEND_RUNNING === '1';

  return {
    backendPort,
    holdOpen,
    dashboardMode
  };
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isAddressInUse(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

async function startOpenAIMockServer() {
  const requests: MockRequestRecord[] = [];
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      requests.push({
        method: req.method,
        path: req.url,
        body: {}
      });

      return sendJson(res, 200, {
        object: 'list',
        data: [{ id: 'gpt-4o-mini', object: 'model' }]
      });
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = await readJsonBody(req);
      requests.push({
        method: req.method,
        path: req.url,
        body
      });
      const model = typeof body.model === 'string' ? body.model : 'gpt-4o-mini';

      return sendJson(res, 200, {
        id: 'chatcmpl-mock-openai',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'mock-openai-response'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 5,
          total_tokens: 17
        }
      });
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  const port = await listenOnAvailablePort(server, randomPortStart());
  return { server, port, requests };
}

async function startAnthropicMockServer() {
  const requests: MockRequestRecord[] = [];
  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/v1/messages') {
      const body = await readJsonBody(req);
      requests.push({
        method: req.method,
        path: req.url,
        body
      });
      const model =
        typeof body.model === 'string' ? body.model : 'claude-3-haiku-20240307';

      return sendJson(res, 200, {
        id: 'msg_mock_anthropic',
        type: 'message',
        role: 'assistant',
        model,
        content: [
          {
            type: 'text',
            text: 'mock-anthropic-response'
          }
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 9,
          output_tokens: 4
        }
      });
    }

    sendJson(res, 404, { error: { message: 'Not found' } });
  });

  const port = await listenOnAvailablePort(server, randomPortStart());
  return { server, port, requests };
}

function listen(server: Server, port: number) {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);

      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve bound server port.'));
        return;
      }

      resolve(address.port);
    });
  });
}

async function listenOnAvailablePort(server: Server, startPort: number, attempts = 50) {
  for (let index = 0; index < attempts; index += 1) {
    const port = startPort + index;

    try {
      return await listen(server, port);
    } catch (error) {
      if (isAddressInUse(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Failed to find an open port starting at ${startPort}.`);
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function removeTestDatabase() {
  fs.rmSync(TEST_DB_PATH, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-journal`, { force: true });
}

function createDeterministicUsageModel() {
  let previousContents: string | null = null;

  if (fs.existsSync(USAGE_MODEL_PATH)) {
    previousContents = fs.readFileSync(USAGE_MODEL_PATH, 'utf8');
  }

  fs.mkdirSync(path.dirname(USAGE_MODEL_PATH), { recursive: true });
  fs.writeFileSync(
    USAGE_MODEL_PATH,
    JSON.stringify(
      {
        averageRequestsPerMinute: 1,
        stdDev: 0.5,
        threshold: DETERMINISTIC_USAGE_THRESHOLD
      },
      null,
      2
    )
  );

  return () => {
    if (previousContents === null) {
      fs.rmSync(USAGE_MODEL_PATH, { force: true });
      return;
    }

    fs.writeFileSync(USAGE_MODEL_PATH, previousContents);
  };
}

function getPrismaDatasourceProvider() {
  const schema = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
  const match = schema.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/);

  if (!match) {
    throw new Error('Failed to detect Prisma datasource provider from prisma/schema.prisma.');
  }

  return match[1];
}

function buildSafePostgresTestUrl(databaseUrl: string) {
  const parsedUrl = new URL(databaseUrl);
  const databaseName = parsedUrl.pathname.replace(/^\//, '');
  const currentSchema = parsedUrl.searchParams.get('schema');

  if (databaseName.toLowerCase().includes('test')) {
    return parsedUrl.toString();
  }

  if (currentSchema && currentSchema.toLowerCase().includes('test')) {
    return parsedUrl.toString();
  }

  const safeSchema = currentSchema ? `${currentSchema}_test` : 'test_proxy';
  parsedUrl.searchParams.set('schema', safeSchema);

  return parsedUrl.toString();
}

function resolveTestDatabaseConfig(): TestDatabaseConfig {
  const provider = getPrismaDatasourceProvider();

  if (provider === 'sqlite') {
    return {
      provider,
      databaseUrl: `file:./${TEST_DB_BASENAME}`,
      cleanup: removeTestDatabase
    };
  }

  if (provider === 'postgresql') {
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

    if (
      !databaseUrl ||
      (!databaseUrl.startsWith('postgresql://') &&
        !databaseUrl.startsWith('postgres://'))
    ) {
      throw new Error(
        'Prisma is configured for PostgreSQL. Set TEST_DATABASE_URL to a dedicated PostgreSQL test database before running bun run test.'
      );
    }

    return {
      provider,
      databaseUrl: buildSafePostgresTestUrl(databaseUrl),
      cleanup: () => {}
    };
  }

  throw new Error(
    `Unsupported Prisma datasource provider for test script: ${provider}`
  );
}

function assertSafeTestDatabase(provider: string, databaseUrl: string) {
  if (provider === 'sqlite') {
    if (!databaseUrl.includes('test')) {
      throw new Error(
        `Refusing to run test setup against non-test SQLite database URL: ${databaseUrl}`
      );
    }

    return;
  }

  if (provider === 'postgresql') {
    const parsedUrl = new URL(databaseUrl);
    const databaseName = parsedUrl.pathname.replace(/^\//, '');
    const schemaName = parsedUrl.searchParams.get('schema') || '';

    if (
      !databaseName.toLowerCase().includes('test') &&
      !schemaName.toLowerCase().includes('test')
    ) {
      throw new Error(
        `Refusing to run test setup against non-test PostgreSQL target: ${databaseName}/${schemaName || 'public'}`
      );
    }
  }
}

function prepareTestDatabase(databaseUrl: string, cleanup: () => void) {
  cleanup();

  const provider = getPrismaDatasourceProvider();
  assertSafeTestDatabase(provider, databaseUrl);

  const result = spawnSync(
    process.execPath,
    ['x', 'prisma', 'db', 'push', '--force-reset', '--skip-generate'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      },
      encoding: 'utf8'
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to prepare test database.\n${result.stdout}\n${result.stderr}`
    );
  }
}

async function findAvailablePort() {
  const probe = createServer();
  const port = await listenOnAvailablePort(probe, randomPortStart());
  await closeServer(probe);
  return port;
}

async function ensurePortAvailable(port: number) {
  const probe = createServer();

  try {
    await listen(probe, port);
  } catch (error) {
    if (isAddressInUse(error)) {
      throw new Error(
        `Port ${port} is already in use. Stop the existing process on that port or rerun without --dashboard.`
      );
    }

    throw error;
  } finally {
    if (probe.listening) {
      await closeServer(probe);
    }
  }
}

async function resolveBackendPort(options: TestRunOptions) {
  if (options.backendPort) {
    await ensurePortAvailable(options.backendPort);
    return options.backendPort;
  }

  return findAvailablePort();
}

async function waitForManualShutdown(apiBaseUrl: string) {
  console.log(
    `\nDashboard smoke mode is active on ${apiBaseUrl}. Keep the dashboard open and press Ctrl+C here when you're done.`
  );

  await new Promise<void>((resolve) => {
    const finish = () => {
      process.off('SIGINT', finish);
      process.off('SIGTERM', finish);
      resolve();
    };

    process.on('SIGINT', finish);
    process.on('SIGTERM', finish);
  });
}

function startBackend(config: {
  backendPort: number;
  openaiMockPort: number;
  anthropicMockPort: number;
  databaseUrl: string;
}): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, ['run', 'src/server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(config.backendPort),
      DATABASE_URL: config.databaseUrl,
      OPENAI_BASE_URL: `http://localhost:${config.openaiMockPort}`,
      ANTHROPIC_BASE_URL: `http://localhost:${config.anthropicMockPort}`,
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      STRIPE_API_KEY: 'test-stripe-key'
    },
    stdio: 'pipe'
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

async function stopBackend(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 2_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

async function waitForHealthCheck(apiBaseUrl: string) {
  const startedAt = Date.now();
  const timeoutMs = 15_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await axios.get<HealthResponse>(`${apiBaseUrl}/health`, {
        timeout: 500
      });

      if (response.status === 200) {
        return;
      }
    } catch {
      await sleep(250);
    }
  }

  throw new Error('Timed out waiting for backend health check.');
}

async function run() {
  const runOptions = parseRunOptions(process.argv.slice(2));
  const testDatabase = resolveTestDatabaseConfig();
  const restoreUsageModel = createDeterministicUsageModel();
  let openaiMock: Awaited<ReturnType<typeof startOpenAIMockServer>> | null = null;
  let anthropicMock: Awaited<ReturnType<typeof startAnthropicMockServer>> | null = null;
  let backend: ChildProcessWithoutNullStreams | null = null;

  try {
    openaiMock = await startOpenAIMockServer();
    anthropicMock = await startAnthropicMockServer();
    const backendPort = await resolveBackendPort(runOptions);
    const apiBaseUrl = `http://localhost:${backendPort}`;
    prepareTestDatabase(testDatabase.databaseUrl, testDatabase.cleanup);

    backend = startBackend({
      backendPort,
      openaiMockPort: openaiMock.port,
      anthropicMockPort: anthropicMock.port,
      databaseUrl: testDatabase.databaseUrl
    });

    await waitForHealthCheck(apiBaseUrl);

    const health = await axios.get<HealthResponse>(`${apiBaseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'SaaS-Sentinel is active');

    const pricingRules = await axios.get<PricingRulesResponse>(
      `${apiBaseUrl}/pricing-rules`
    );
    assert.equal(pricingRules.status, 200);
    assert.ok(pricingRules.data.count >= 3);

    const openaiResponse = await axios.post(`${apiBaseUrl}/proxy/openai/v1/chat/completions`, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello from local test' }]
    });
    assert.equal(openaiResponse.status, 200);
    assert.equal(openaiResponse.data.object, 'chat.completion');
    assert.equal(
      openaiResponse.data.choices?.[0]?.message?.content,
      'mock-openai-response'
    );

    const anthropicResponse = await axios.post(
      `${apiBaseUrl}/proxy/anthropic/v1/messages`,
      {
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hello from local test' }],
        max_tokens: 128
      }
    );
    assert.equal(anthropicResponse.status, 200);
    assert.equal(
      anthropicResponse.data.content?.[0]?.text,
      'mock-anthropic-response'
    );

    const burstResponses = [];
    for (let index = 0; index < OPENAI_BURST_REQUEST_COUNT; index += 1) {
      const response = await axios.post(
        `${apiBaseUrl}/proxy/openai/v1/chat/completions`,
        {
          model: 'gpt-4',
          messages: [{ role: 'user', content: `Burst request ${index}` }]
        },
        {
          validateStatus: () => true
        }
      );

      burstResponses.push(response);
    }

    const blockedBurstResponses = burstResponses.filter(
      (response) =>
        response.status === 403 &&
        response.data?.reason === 'OVERLOAD' &&
        Array.isArray(response.data?.actions) &&
        response.data.actions.includes('BLOCK')
    );

    assert.ok(
      burstResponses.some(
        (response) =>
          response.status === 200 &&
          response.data?.choices?.[0]?.message?.content ===
            'mock-openai-response' &&
          response.data?.model === 'gpt-3.5-turbo'
      )
    );
    assert.ok(blockedBurstResponses.length >= 3);

    const blockedResponse = await axios.get<BlockedResponse>(
      `${apiBaseUrl}/proxy/openai/v1/models`,
      {
        validateStatus: () => true
      }
    );
    assert.equal(blockedResponse.status, 403);
    assert.equal(blockedResponse.data.reason, 'OVERLOAD');
    assert.ok(blockedResponse.data.actions.includes('BLOCK'));

    const metrics = await axios.get<MetricsResponse>(`${apiBaseUrl}/metrics`);
    assert.ok(metrics.data.totalCalls >= OPENAI_BURST_REQUEST_COUNT + 3);
    assert.ok(metrics.data.breakdown.some((item) => item.service === 'openai'));
    assert.ok(
      metrics.data.breakdown.some(
        (item) => item.service === 'anthropic' && item.calls >= 1
      )
    );

    const summary = await axios.get<SummaryResponse>(
      `${apiBaseUrl}/analytics/summary`
    );
    assert.ok(summary.data.totalRequests >= OPENAI_BURST_REQUEST_COUNT + 3);
    assert.ok(summary.data.totalCost >= 0);

    const enforcements = await axios.get<EnforcementResponse>(
      `${apiBaseUrl}/enforcements`,
      {
        params: {
          service: 'openai',
          limit: 20
        }
      }
    );

    assert.ok(enforcements.data.count >= 1);
    assert.ok(
      enforcements.data.logs.some(
        (log) =>
          log.severity === 'HIGH' &&
          log.action.includes('BLOCK')
      )
    );

    assert.ok(
      openaiMock.requests.some(
        (request) => request.path === '/v1/chat/completions'
      )
    );
    assert.ok(
      anthropicMock.requests.filter((request) => request.path === '/v1/messages')
        .length >= 1
    );

    console.log('\nLocal proxy integration test passed.');

    if (runOptions.holdOpen) {
      await waitForManualShutdown(apiBaseUrl);
    }
  } finally {
    if (backend) {
      await stopBackend(backend);
    }

    await Promise.all([
      openaiMock ? closeServer(openaiMock.server) : Promise.resolve(),
      anthropicMock ? closeServer(anthropicMock.server) : Promise.resolve()
    ]);

    testDatabase.cleanup();
    restoreUsageModel();
  }
}

run().catch((error) => {
  console.error('\nLocal proxy integration test failed.');
  console.error(error);
  process.exitCode = 1;
});
