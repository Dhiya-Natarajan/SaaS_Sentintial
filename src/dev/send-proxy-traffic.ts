import axios from 'axios';

const DEFAULT_PROXY_BASE_URL = process.env.SENTINEL_PROXY_BASE_URL || 'http://localhost:3001';

interface TrafficCounts {
  openai: number;
  anthropic: number;
  stripe: number;
}

interface ServiceRunSummary {
  attempted: number;
  succeeded: number;
  blocked: number;
  failed: number;
}

interface TrafficSummary {
  openai: ServiceRunSummary;
  anthropic: ServiceRunSummary;
  stripe: ServiceRunSummary;
}

function parseCount(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): TrafficCounts {
  const values = new Map<string, string>();

  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (key && value) {
      values.set(key, value);
    }
  }

  return {
    openai: parseCount(values.get('--openai') || process.env.OPENAI_REQUEST_COUNT, 8),
    anthropic: parseCount(values.get('--anthropic') || process.env.ANTHROPIC_REQUEST_COUNT, 5),
    stripe: parseCount(values.get('--stripe') || process.env.STRIPE_REQUEST_COUNT, 5)
  };
}

function createServiceRunSummary(attempted: number): ServiceRunSummary {
  return {
    attempted,
    succeeded: 0,
    blocked: 0,
    failed: 0
  };
}

async function sendRequest(
  service: keyof TrafficSummary,
  summary: TrafficSummary,
  config: Parameters<typeof axios.request>[0]
) {
  try {
    const response = await axios.request({
      ...config,
      validateStatus: () => true
    });

    if (response.status === 403) {
      summary[service].blocked += 1;
      return;
    }

    if (response.status >= 200 && response.status < 300) {
      summary[service].succeeded += 1;
      return;
    }

    summary[service].failed += 1;
    console.warn(`[${service}] unexpected status ${response.status}`, response.data);
  } catch (error) {
    summary[service].failed += 1;

    if (axios.isAxiosError(error)) {
      console.warn(`[${service}] request failed`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return;
    }

    console.warn(`[${service}] request failed`, error);
  }
}

async function sendOpenAIRequests(count: number, summary: TrafficSummary) {
  for (let index = 0; index < count; index += 1) {
    await sendRequest('openai', summary, {
      method: 'POST',
      url: `${DEFAULT_PROXY_BASE_URL}/proxy/openai/v1/chat/completions`,
      data: {
        model: index % 3 === 0 ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `mock openai request ${index + 1}`
          }
        ],
        max_tokens: 64
      }
    });
  }
}

async function sendAnthropicRequests(count: number, summary: TrafficSummary) {
  for (let index = 0; index < count; index += 1) {
    await sendRequest('anthropic', summary, {
      method: 'POST',
      url: `${DEFAULT_PROXY_BASE_URL}/proxy/anthropic/v1/messages`,
      data: {
        model: 'claude-3-haiku-20240307',
        max_tokens: 128,
        messages: [
          {
            role: 'user',
            content: `mock anthropic request ${index + 1}`
          }
        ]
      }
    });
  }
}

async function sendStripeRequests(count: number, summary: TrafficSummary) {
  for (let index = 0; index < count; index += 1) {
    await sendRequest('stripe', summary, {
      method: 'POST',
      url: `${DEFAULT_PROXY_BASE_URL}/proxy/stripe/v1/payment_intents`,
      data: {
        amount: 1000 + (index * 100),
        currency: 'usd',
        confirm: false
      }
    });
  }
}

async function main() {
  const counts = parseArgs(process.argv.slice(2));
  const summary: TrafficSummary = {
    openai: createServiceRunSummary(counts.openai),
    anthropic: createServiceRunSummary(counts.anthropic),
    stripe: createServiceRunSummary(counts.stripe)
  };

  console.log('Sending proxy traffic with counts:', counts);
  console.log(`Proxy base URL: ${DEFAULT_PROXY_BASE_URL}`);

  await Promise.all([
    sendOpenAIRequests(counts.openai, summary),
    sendAnthropicRequests(counts.anthropic, summary),
    sendStripeRequests(counts.stripe, summary)
  ]);

  console.log('Traffic generation complete.');
  console.table(summary);
}

main().catch((error) => {
  if (axios.isAxiosError(error)) {
    console.error('Traffic generation failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  } else {
    console.error('Traffic generation failed:', error);
  }

  process.exit(1);
});
