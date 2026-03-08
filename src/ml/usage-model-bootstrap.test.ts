import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureUsageModelReady } from './usage-model-bootstrap';

function buildUsageModel(threshold: number) {
  return {
    averageRequestsPerMinute: threshold / 2,
    stdDev: threshold / 6,
    threshold
  };
}

test('loads the existing usage model without retraining', async () => {
  let reloadCalls = 0;
  let trainCalls = 0;

  const result = await ensureUsageModelReady({
    fileExists: () => true,
    reloadModel: () => {
      reloadCalls += 1;
      return { threshold: 10 };
    },
    trainModel: async () => {
      trainCalls += 1;
      return buildUsageModel(20);
    }
  });

  assert.deepEqual(result, {
    ready: true,
    source: 'existing'
  });
  assert.equal(reloadCalls, 1);
  assert.equal(trainCalls, 0);
});

test('trains the usage model when it is missing', async () => {
  let reloadCalls = 0;
  let trainCalls = 0;

  const result = await ensureUsageModelReady({
    fileExists: () => false,
    reloadModel: () => {
      reloadCalls += 1;
      return { threshold: 10 };
    },
    trainModel: async () => {
      trainCalls += 1;
      return buildUsageModel(20);
    }
  });

  assert.deepEqual(result, {
    ready: true,
    source: 'trained'
  });
  assert.equal(reloadCalls, 1);
  assert.equal(trainCalls, 1);
});

test('retries with retraining when the existing model cannot be loaded', async () => {
  let resetCalls = 0;
  let trainCalls = 0;

  const result = await ensureUsageModelReady({
    fileExists: () => true,
    reloadModel: (() => {
      let attempts = 0;
      return () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('invalid json');
        }

        return { threshold: 10 };
      };
    })(),
    resetModelCache: () => {
      resetCalls += 1;
    },
    trainModel: async () => {
      trainCalls += 1;
      return buildUsageModel(20);
    }
  });

  assert.deepEqual(result, {
    ready: true,
    source: 'trained'
  });
  assert.equal(resetCalls, 1);
  assert.equal(trainCalls, 1);
});

test('returns unavailable when no usage model can be trained', async () => {
  let reloadCalls = 0;

  const result = await ensureUsageModelReady({
    fileExists: () => false,
    reloadModel: () => {
      reloadCalls += 1;
      return { threshold: 10 };
    },
    trainModel: async () => null
  });

  assert.deepEqual(result, {
    ready: false,
    source: 'unavailable'
  });
  assert.equal(reloadCalls, 0);
});
