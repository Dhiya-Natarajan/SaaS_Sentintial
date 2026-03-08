import assert from 'node:assert/strict';
import test from 'node:test';

import { getStats } from './metrics.service';

test('returns numeric call counts in the metrics breakdown', async () => {
  const stats = await getStats({
    apiMetric: {
      count: async () => 5,
      groupBy: async () => [
        {
          service: 'openai',
          _count: { _all: 3 },
          _sum: { latencyMs: 1200, cost: 0.6 }
        },
        {
          service: 'stripe',
          _count: { _all: 2 },
          _sum: { latencyMs: null, cost: null }
        }
      ]
    }
  } as any);

  assert.deepEqual(stats, {
    totalCalls: 5,
    breakdown: [
      {
        service: 'openai',
        calls: 3,
        totalLatency: 1200,
        totalCost: 0.6
      },
      {
        service: 'stripe',
        calls: 2,
        totalLatency: 0,
        totalCost: 0
      }
    ]
  });
});
