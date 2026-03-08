import { randomUUID } from 'crypto';
import type { IncomingHttpHeaders } from 'http';

export type ProviderService = 'openai' | 'anthropic' | 'stripe';
export type RequestKind =
  | 'generic'
  | 'openai-chat-completions'
  | 'anthropic-messages'
  | 'stripe-request';

export interface RequestClassification {
  requestKind: RequestKind;
  rerouteEligible: boolean;
}

export interface UpstreamResponseTransformResult {
  body: Buffer | string;
  headers?: Record<string, string>;
  statusCode?: number;
}

export type UpstreamResponseTransformer = (input: {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}) => UpstreamResponseTransformResult;

export interface PreparedUpstreamRequest {
  target: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  responseTransformer?: UpstreamResponseTransformer;
}

interface PrepareUpstreamRequestInput {
  originalService: ProviderService;
  routedService: ProviderService;
  method: string;
  path: string;
  body?: unknown;
  headers?: IncomingHttpHeaders;
}

type OpenAIMessageRole = 'system' | 'user' | 'assistant';

interface ParsedOpenAIMessage {
  role: OpenAIMessageRole;
  content: string;
}

interface ParsedOpenAIChatRequest {
  model: string;
  messages: ParsedOpenAIMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stop?: string | string[];
}

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_ANTHROPIC_FALLBACK_MODEL = 'claude-3-haiku-20240307';

export const PROVIDER_SERVICES: ProviderService[] = ['openai', 'anthropic', 'stripe'];

export function classifyRequest(
  service: ProviderService,
  method: string,
  path: string,
  body?: unknown
): RequestClassification {
  const normalizedMethod = method.toUpperCase();
  const pathWithoutQuery = stripQuery(path);

  if (service === 'stripe') {
    return {
      requestKind: 'stripe-request',
      rerouteEligible: false
    };
  }

  if (service === 'anthropic' && normalizedMethod === 'POST' && pathWithoutQuery === '/v1/messages') {
    return {
      requestKind: 'anthropic-messages',
      rerouteEligible: false
    };
  }

  if (service === 'openai' && normalizedMethod === 'POST' && pathWithoutQuery === '/v1/chat/completions') {
    return {
      requestKind: 'openai-chat-completions',
      rerouteEligible: parseOpenAIChatRequest(body) !== null
    };
  }

  return {
    requestKind: 'generic',
    rerouteEligible: false
  };
}

export function prepareUpstreamRequest(
  input: PrepareUpstreamRequestInput
): PreparedUpstreamRequest {
  if (input.originalService === input.routedService) {
    return buildDirectRequest(input.routedService, input.path, input.body);
  }

  if (input.originalService === 'openai' && input.routedService === 'anthropic') {
    return buildOpenAIToAnthropicRequest(input);
  }

  throw new Error(
    `Unsupported reroute from ${input.originalService} to ${input.routedService}`
  );
}

function buildDirectRequest(
  service: ProviderService,
  path: string,
  body?: unknown
): PreparedUpstreamRequest {
  return {
    target: getProviderTarget(service),
    path,
    headers: getProviderHeaders(service),
    body
  };
}

function buildOpenAIToAnthropicRequest(
  input: PrepareUpstreamRequestInput
): PreparedUpstreamRequest {
  const parsed = parseOpenAIChatRequest(input.body);

  if (!parsed) {
    throw new Error('Request is not compatible with Anthropic reroute');
  }

  const systemPrompts = parsed.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content);

  const anthropicMessages = parsed.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  const anthropicBody: Record<string, unknown> = {
    model: mapOpenAIModelToAnthropic(parsed.model),
    messages: anthropicMessages,
    max_tokens: parsed.maxTokens
  };

  if (systemPrompts.length > 0) {
    anthropicBody.system = systemPrompts.join('\n\n');
  }
  if (typeof parsed.temperature === 'number') {
    anthropicBody.temperature = parsed.temperature;
  }
  if (typeof parsed.topP === 'number') {
    anthropicBody.top_p = parsed.topP;
  }
  if (typeof parsed.stop === 'string') {
    anthropicBody.stop_sequences = [parsed.stop];
  } else if (Array.isArray(parsed.stop)) {
    anthropicBody.stop_sequences = parsed.stop;
  }

  return {
    target: getProviderTarget('anthropic'),
    path: '/v1/messages',
    headers: getProviderHeaders('anthropic'),
    body: anthropicBody,
    responseTransformer: ({ body, headers, statusCode }) =>
      normalizeAnthropicResponseToOpenAI({
        body,
        headers,
        statusCode,
        originalModel: parsed.model
      })
  };
}

function normalizeAnthropicResponseToOpenAI(input: {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
  originalModel: string;
}): UpstreamResponseTransformResult {
  if (input.statusCode >= 400) {
    const parsed = safeJsonParse(input.body);
    const message =
      getNestedString(parsed, ['error', 'message']) || input.body.toString('utf-8');

    return {
      statusCode: input.statusCode,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        error: {
          message,
          type: 'upstream_error'
        }
      })
    };
  }

  const parsed = safeJsonParse(input.body) as Record<string, unknown> | null;
  const content = Array.isArray(parsed?.content)
    ? parsed?.content
        .filter((item) => isPlainObject(item) && item.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text as string)
        .join('\n')
    : '';

  const inputTokens = getNestedNumber(parsed, ['usage', 'input_tokens']) || 0;
  const outputTokens = getNestedNumber(parsed, ['usage', 'output_tokens']) || 0;
  const finishReason = mapAnthropicStopReason(
    getNestedString(parsed, ['stop_reason']) || undefined
  );

  return {
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      id: typeof parsed?.id === 'string' ? parsed.id : `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: input.originalModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content
          },
          finish_reason: finishReason
        }
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      }
    })
  };
}

function mapAnthropicStopReason(stopReason?: string) {
  if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
    return 'stop';
  }
  if (stopReason === 'max_tokens') {
    return 'length';
  }
  return 'stop';
}

function parseOpenAIChatRequest(body?: unknown): ParsedOpenAIChatRequest | null {
  if (!isPlainObject(body)) {
    return null;
  }

  if (typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return null;
  }

  if (
    body.stream === true ||
    body.tools !== undefined ||
    body.tool_choice !== undefined ||
    body.functions !== undefined ||
    body.function_call !== undefined ||
    body.parallel_tool_calls !== undefined
  ) {
    return null;
  }

  const messages: ParsedOpenAIMessage[] = [];

  for (const message of body.messages) {
    if (!isPlainObject(message) || typeof message.role !== 'string') {
      return null;
    }

    if (!isSupportedOpenAIRole(message.role)) {
      return null;
    }

    const normalizedContent = normalizeOpenAIContent(message.content);
    if (normalizedContent === null) {
      return null;
    }

    messages.push({
      role: message.role,
      content: normalizedContent
    });
  }

  const maxTokens = getBodyNumber(body.max_tokens)
    ?? getBodyNumber(body.max_completion_tokens)
    ?? 1024;

  return {
    model: body.model,
    messages,
    maxTokens,
    temperature: getBodyNumber(body.temperature),
    topP: getBodyNumber(body.top_p),
    stop: normalizeStop(body.stop)
  };
}

function normalizeStop(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  return undefined;
}

function normalizeOpenAIContent(content: unknown): string | null {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const parts: string[] = [];

  for (const item of content) {
    if (!isPlainObject(item) || item.type !== 'text' || typeof item.text !== 'string') {
      return null;
    }
    parts.push(item.text);
  }

  return parts.join('\n');
}

function isSupportedOpenAIRole(role: string): role is OpenAIMessageRole {
  return role === 'system' || role === 'user' || role === 'assistant';
}

function mapOpenAIModelToAnthropic(model: string) {
  const configuredFallback =
    process.env.SENTINEL_ANTHROPIC_FALLBACK_MODEL || DEFAULT_ANTHROPIC_FALLBACK_MODEL;

  const modelMap: Record<string, string> = {
    'gpt-4': configuredFallback,
    'gpt-4o': configuredFallback,
    'gpt-4o-mini': configuredFallback,
    'gpt-3.5-turbo': configuredFallback
  };

  return modelMap[model] || configuredFallback;
}

function getProviderTarget(service: ProviderService) {
  switch (service) {
    case 'openai':
      return process.env.OPENAI_BASE_URL || 'https://api.openai.com';
    case 'anthropic':
      return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    case 'stripe':
      return process.env.STRIPE_BASE_URL || 'https://api.stripe.com';
  }
}

function getProviderHeaders(service: ProviderService): Record<string, string> {
  switch (service) {
    case 'openai':
      return {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'sk-placeholder'}`
      };
    case 'anthropic':
      return {
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'sk-ant-placeholder',
        'anthropic-version':
          process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION
      };
    case 'stripe':
      return {
        Authorization: `Bearer ${process.env.STRIPE_API_KEY || 'sk_test_placeholder'}`
      };
  }
}

function stripQuery(path: string) {
  return path.split('?')[0] || '/';
}

function getBodyNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeJsonParse(body: Buffer) {
  try {
    return JSON.parse(body.toString('utf-8'));
  } catch {
    return null;
  }
}

function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!isPlainObject(current) || !(key in current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === 'string' ? current : null;
}

function getNestedNumber(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!isPlainObject(current) || !(key in current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === 'number' ? current : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
