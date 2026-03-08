import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  createControlMiddleware
} from './proxy.middleware';
import type { ControlDecision } from '../services/control-engine.service';
import type { ApiMetric } from '../services/metrics.service';
import type { PreparedUpstreamRequest } from '../providers/provider-routing';

function createDecision(
  overrides: Partial<ControlDecision> = {}
): ControlDecision {
  return {
    service: 'openai',
    routedService: 'openai',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    isAnomaly: false,
    reason: 'NONE',
    severity: 'NONE',
    throttleMs: 0,
    actions: [],
    currentUsage: 1,
    anomalyThreshold: 10,
    anomalyMultiplier: 0.1,
    modifiedBody: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }]
    },
    ...overrides
  };
}

function createMockRequest(body: unknown): Request & {
  _controlDecision?: ControlDecision;
  _upstreamRequest?: PreparedUpstreamRequest;
  _startTime?: number;
} {
  return {
    method: 'POST',
    url: '/v1/chat/completions',
    headers: {
      'content-type': 'application/json'
    },
    body
  } as Request & {
    _controlDecision?: ControlDecision;
    _upstreamRequest?: PreparedUpstreamRequest;
    _startTime?: number;
  };
}

function createMockResponse() {
  const state: {
    statusCode?: number;
    jsonBody?: unknown;
  } = {};

  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      state.jsonBody = payload;
      return response;
    }
  };

  return {
    response: response as unknown as Response,
    state
  };
}

describe('createControlMiddleware', () => {
  it('returns 403 with structured policy details for blocked requests', async () => {
    const metrics: ApiMetric[] = [];
    const req = createMockRequest({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    const { response, state } = createMockResponse();
    let nextCalled = false;

    const middleware = createControlMiddleware('openai', {
      controlEngine: {
        evaluate: async () => createDecision({
          reason: 'SECURITY_POLICY',
          actions: ['BLOCK']
        })
      },
      anomalyDetector: {
        detectAnomaly: async () => ({ isAnomaly: false, score: 0 })
      },
      logMetric: async (metric) => {
        metrics.push(metric);
      }
    });

    await middleware(req, response, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(state.statusCode, 403);
    assert.deepEqual(state.jsonBody, {
      error: 'Request blocked by SaaS-Sentinel policy.',
      reason: 'SECURITY_POLICY',
      actions: ['BLOCK']
    });
    assert.equal(nextCalled, false);
    assert.equal(metrics.length, 0);
  });

  it('prepares Anthropic-native upstream requests for rerouted compatible OpenAI chat traffic', async () => {
    process.env.ANTHROPIC_BASE_URL = 'http://anthropic.local';
    process.env.ANTHROPIC_API_KEY = 'anthropic-proxy-key';

    const req = createMockRequest({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    const { response } = createMockResponse();
    let nextCalled = false;

    const middleware = createControlMiddleware('openai', {
      controlEngine: {
        evaluate: async (input) => createDecision({
          service: input.service,
          endpoint: input.endpoint,
          method: input.method,
          reason: 'OVERLOAD',
          severity: 'HIGH',
          isAnomaly: true,
          actions: ['REROUTE'],
          routedService: 'anthropic',
          modifiedBody: input.requestBody
        })
      },
      anomalyDetector: {
        detectAnomaly: async () => ({ isAnomaly: false, score: 0 })
      },
      logMetric: async () => undefined
    });

    await middleware(req, response, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(req._controlDecision?.routedService, 'anthropic');
    assert.equal(req._upstreamRequest?.target, 'http://anthropic.local');
    assert.equal(req._upstreamRequest?.path, '/v1/messages');
    assert.equal(req._upstreamRequest?.headers['x-api-key'], 'anthropic-proxy-key');
    assert.deepEqual(req.body, {
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024
    });
  });

  it('keeps non-reroutable overload requests on the original provider path', async () => {
    process.env.OPENAI_BASE_URL = 'http://openai.local';
    process.env.OPENAI_API_KEY = 'openai-proxy-key';
    process.env.ANTHROPIC_BASE_URL = 'http://anthropic.local';

    const req = createMockRequest({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'lookup' } }]
    });
    const { response } = createMockResponse();
    let nextCalled = false;
    let seenRerouteEligible: boolean | undefined;

    const middleware = createControlMiddleware('openai', {
      controlEngine: {
        evaluate: async (input) => {
          seenRerouteEligible = input.rerouteEligible;
          return createDecision({
            service: input.service,
            endpoint: input.endpoint,
            method: input.method,
            reason: 'OVERLOAD',
            severity: 'HIGH',
            isAnomaly: true,
            actions: ['THROTTLE'],
            routedService: 'openai',
            currentUsage: input.currentUsage,
            anomalyMultiplier: 2,
            modifiedBody: input.requestBody
          });
        }
      },
      anomalyDetector: {
        detectAnomaly: async () => ({ isAnomaly: false, score: 0 })
      },
      logMetric: async () => undefined
    });

    await middleware(req, response, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(seenRerouteEligible, false);
    assert.ok(!req._controlDecision?.actions.includes('REROUTE'));
    assert.equal(req._controlDecision?.routedService, 'openai');
    assert.equal(req._upstreamRequest?.target, 'http://openai.local');
    assert.equal(req._upstreamRequest?.path, '/v1/chat/completions');
    assert.equal(req._upstreamRequest?.headers.Authorization, 'Bearer openai-proxy-key');
  });
});
