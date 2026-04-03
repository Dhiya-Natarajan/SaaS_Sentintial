import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

type MockService = 'openai' | 'anthropic' | 'stripe';

interface MockRequestRecord {
  service: MockService;
  method: string;
  path: string;
  body: Record<string, unknown>;
}

const DEFAULT_OPENAI_PORT = 4101;
const DEFAULT_ANTHROPIC_PORT = 4102;
const DEFAULT_STRIPE_PORT = 4103;

function readJsonBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createOpenAIMockServer(requests: MockRequestRecord[]) {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      requests.push({
        service: 'openai',
        method: 'GET',
        path: '/v1/models',
        body: {}
      });

      return sendJson(res, 200, {
        object: 'list',
        data: [
          { id: 'gpt-4o-mini', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' }
        ]
      });
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = await readJsonBody(req);
      requests.push({
        service: 'openai',
        method: 'POST',
        path: '/v1/chat/completions',
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
          prompt_tokens: 24,
          completion_tokens: 12,
          total_tokens: 36
        }
      });
    }

    return sendJson(res, 404, { error: 'Not found' });
  });
}

function createAnthropicMockServer(requests: MockRequestRecord[]) {
  return createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/v1/messages') {
      const body = await readJsonBody(req);
      requests.push({
        service: 'anthropic',
        method: 'POST',
        path: '/v1/messages',
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
          input_tokens: 18,
          output_tokens: 9
        }
      });
    }

    return sendJson(res, 404, { error: { message: 'Not found' } });
  });
}

function createStripeMockServer(requests: MockRequestRecord[]) {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/v1/balance') {
      requests.push({
        service: 'stripe',
        method: 'GET',
        path: '/v1/balance',
        body: {}
      });

      return sendJson(res, 200, {
        object: 'balance',
        available: [{ amount: 125000, currency: 'usd' }]
      });
    }

    if (req.method === 'POST' && req.url === '/v1/payment_intents') {
      const body = await readJsonBody(req);
      requests.push({
        service: 'stripe',
        method: 'POST',
        path: '/v1/payment_intents',
        body
      });

      return sendJson(res, 200, {
        id: 'pi_mock_123',
        object: 'payment_intent',
        amount: typeof body.amount === 'number' ? body.amount : 2000,
        currency: typeof body.currency === 'string' ? body.currency : 'usd',
        status: 'requires_confirmation'
      });
    }

    return sendJson(res, 404, { error: { message: 'Not found' } });
  });
}

function startServer(server: ReturnType<typeof createServer>, port: number, label: string) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      console.log(`${label} mock listening on http://localhost:${port}`);
      resolve();
    });
  });
}

async function main() {
  const requests: MockRequestRecord[] = [];
  const openaiPort = parsePort(process.env.MOCK_OPENAI_PORT, DEFAULT_OPENAI_PORT);
  const anthropicPort = parsePort(process.env.MOCK_ANTHROPIC_PORT, DEFAULT_ANTHROPIC_PORT);
  const stripePort = parsePort(process.env.MOCK_STRIPE_PORT, DEFAULT_STRIPE_PORT);

  const openaiServer = createOpenAIMockServer(requests);
  const anthropicServer = createAnthropicMockServer(requests);
  const stripeServer = createStripeMockServer(requests);

  await Promise.all([
    startServer(openaiServer, openaiPort, 'OpenAI'),
    startServer(anthropicServer, anthropicPort, 'Anthropic'),
    startServer(stripeServer, stripePort, 'Stripe')
  ]);

  console.log('');
  console.log('Use these backend env vars:');
  console.log(`OPENAI_BASE_URL=http://localhost:${openaiPort}`);
  console.log(`ANTHROPIC_BASE_URL=http://localhost:${anthropicPort}`);
  console.log(`STRIPE_BASE_URL=http://localhost:${stripePort}`);
  console.log('');
  console.log('Press Ctrl+C to stop the mock upstreams.');

  const shutdown = () => {
    console.log('');
    console.log('Mock upstream request counts:', {
      openai: requests.filter((request) => request.service === 'openai').length,
      anthropic: requests.filter((request) => request.service === 'anthropic').length,
      stripe: requests.filter((request) => request.service === 'stripe').length
    });

    openaiServer.close();
    anthropicServer.close();
    stripeServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start mock upstreams:', error);
  process.exit(1);
});
