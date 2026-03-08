import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRetrainStatus } from './retrain-status';

test('reports full retraining when both models succeed', () => {
  assert.deepEqual(buildRetrainStatus(true, true), {
    status: 'trained',
    message: 'Usage and response anomaly models retrained successfully.'
  });
});

test('reports partial retraining when only the usage model succeeds', () => {
  assert.deepEqual(buildRetrainStatus(true, false), {
    status: 'partial',
    message: 'Usage model retrained, but the response anomaly model was skipped because there was not enough data.'
  });
});

test('reports partial retraining when only the response model succeeds', () => {
  assert.deepEqual(buildRetrainStatus(false, true), {
    status: 'partial',
    message: 'Response anomaly model retrained, but the usage model was skipped because there was not enough data.'
  });
});

test('reports skipped retraining when neither model can train', () => {
  assert.deepEqual(buildRetrainStatus(false, false), {
    status: 'skipped',
    message: 'No models were retrained because there was not enough data.'
  });
});
