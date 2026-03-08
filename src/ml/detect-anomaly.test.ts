import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test from 'node:test';

import {
  detectUsageAnomaly,
  resetUsageModelCache
} from './detect-anomaly';
import { USAGE_MODEL_PATH } from './model-paths';

test('reloads the usage threshold when the model file changes on disk', async () => {
  const previousFile = fs.existsSync(USAGE_MODEL_PATH)
    ? fs.readFileSync(USAGE_MODEL_PATH, 'utf-8')
    : null;

  fs.mkdirSync(path.dirname(USAGE_MODEL_PATH), { recursive: true });

  try {
    fs.writeFileSync(
      USAGE_MODEL_PATH,
      JSON.stringify({
        averageRequestsPerMinute: 5,
        stdDev: 1,
        threshold: 10
      })
    );

    resetUsageModelCache();

    assert.equal(detectUsageAnomaly(12).threshold, 10);
    assert.equal(detectUsageAnomaly(12).severity, 'LOW');

    fs.writeFileSync(
      USAGE_MODEL_PATH,
      JSON.stringify({
        averageRequestsPerMinute: 10,
        stdDev: 2,
        threshold: 20
      })
    );

    const nextTimestamp = new Date(Date.now() + 2000);
    fs.utimesSync(USAGE_MODEL_PATH, nextTimestamp, nextTimestamp);

    assert.equal(detectUsageAnomaly(12).threshold, 20);
    assert.equal(detectUsageAnomaly(12).severity, 'NONE');
  } finally {
    if (previousFile === null) {
      fs.rmSync(USAGE_MODEL_PATH, { force: true });
    } else {
      fs.writeFileSync(USAGE_MODEL_PATH, previousFile);
    }

    resetUsageModelCache();
  }
});
