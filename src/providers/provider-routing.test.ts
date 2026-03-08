import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyRequest,
  prepareUpstreamRequest
} from './provider-routing';

describe('provider routing', () => {
  it('uses Anthropic-native headers for direct Anthropic requests', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://anthropic.local';
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    process.env.ANTHROPIC_VERSION = '2023-06-01';

    const prepared = prepareUpstreamRequest({
      originalService: 'anthropic',
      routedService: 'anthropic',
      method: 'POST',
      path: '/v1/messages',
      body: { model: 'claude-test', messages: [] }
    });

    assert.equal(prepared.target, 'http://anthropic.local');
    assert.equal(prepared.path, '/v1/messages');
    assert.equal(prepared.headers['x-api-key'], 'anthropic-test-key');
    assert.equal(prepared.headers['anthropic-version'], '2023-06-01');
    assert.equal(prepared.headers.Authorization, undefined);
  });

  it('keeps direct OpenAI and Stripe requests as native passthroughs', () => {
    process.env.OPENAI_BASE_URL = 'http://openai.local';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.STRIPE_BASE_URL = 'http://stripe.local';
    process.env.STRIPE_API_KEY = 'stripe-test-key';

    const openaiPrepared = prepareUpstreamRequest({
      originalService: 'openai',
      routedService: 'openai',
      method: 'POST',
      path: '/v1/chat/completions',
      body: { model: 'gpt-4', messages: [] }
    });
    const stripePrepared = prepareUpstreamRequest({
      originalService: 'stripe',
      routedService: 'stripe',
      method: 'GET',
      path: '/v1/charges',
      body: undefined
    });

    assert.equal(openaiPrepared.target, 'http://openai.local');
    assert.equal(openaiPrepared.headers.Authorization, 'Bearer openai-test-key');
    assert.equal(openaiPrepared.path, '/v1/chat/completions');

    assert.equal(stripePrepared.target, 'http://stripe.local');
    assert.equal(stripePrepared.headers.Authorization, 'Bearer stripe-test-key');
    assert.equal(stripePrepared.path, '/v1/charges');
  });

  it('translates OpenAI chat requests to Anthropic and normalizes the response back', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://anthropic.local';
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    process.env.SENTINEL_ANTHROPIC_FALLBACK_MODEL = 'claude-3-haiku-20240307';

    const prepared = prepareUpstreamRequest({
      originalService: 'openai',
      routedService: 'anthropic',
      method: 'POST',
      path: '/v1/chat/completions',
      body: {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are concise.' },
          { role: 'user', content: 'Say hello.' }
        ],
        max_tokens: 128
      }
    });

    assert.equal(prepared.target, 'http://anthropic.local');
    assert.equal(prepared.path, '/v1/messages');
    assert.equal(prepared.headers['x-api-key'], 'anthropic-test-key');
    assert.ok(typeof prepared.responseTransformer === 'function');

    const translatedBody = prepared.body as Record<string, unknown>;
    assert.equal(translatedBody.system, 'You are concise.');
    assert.deepEqual(translatedBody.messages, [
      {
        role: 'user',
        content: 'Say hello.'
      }
    ]);

    const normalized = prepared.responseTransformer!({
      statusCode: 200,
      headers: {},
      body: Buffer.from(JSON.stringify({
        id: 'msg_1',
        content: [{ type: 'text', text: 'Hello from Anthropic' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 5,
          output_tokens: 7
        }
      }))
    });

    const normalizedBody = JSON.parse(String(normalized.body));
    assert.equal(normalizedBody.object, 'chat.completion');
    assert.equal(normalizedBody.choices[0].message.content, 'Hello from Anthropic');
    assert.equal(normalizedBody.usage.total_tokens, 12);
  });

  it('marks only compatible non-streaming OpenAI chat requests as reroute-eligible', () => {
    const reroutable = classifyRequest('openai', 'POST', '/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    const incompatible = classifyRequest('openai', 'POST', '/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'lookup' } }]
    });

    assert.equal(reroutable.rerouteEligible, true);
    assert.equal(incompatible.rerouteEligible, false);
  });
});
