import fs from 'fs';

import { reloadUsageModel, resetUsageModelCache } from './detect-anomaly';
import { USAGE_MODEL_PATH } from './model-paths';
import { trainUsageBaseline } from './train-model';

export interface UsageModelBootstrapResult {
  ready: boolean;
  source: 'existing' | 'trained' | 'unavailable';
}

interface UsageModelBootstrapDependencies {
  fileExists?: (path: string) => boolean;
  reloadModel?: typeof reloadUsageModel;
  resetModelCache?: typeof resetUsageModelCache;
  trainModel?: typeof trainUsageBaseline;
}

export async function ensureUsageModelReady(
  dependencies: UsageModelBootstrapDependencies = {}
): Promise<UsageModelBootstrapResult> {
  const fileExists = dependencies.fileExists || fs.existsSync;
  const reloadModel = dependencies.reloadModel || reloadUsageModel;
  const resetModelCache = dependencies.resetModelCache || resetUsageModelCache;
  const trainModel = dependencies.trainModel || trainUsageBaseline;

  if (fileExists(USAGE_MODEL_PATH)) {
    try {
      reloadModel();
      return {
        ready: true,
        source: 'existing'
      };
    } catch (error) {
      console.warn('Failed to load existing usage model, attempting retraining.', error);
      resetModelCache();
    }
  }

  const model = await trainModel();

  if (!model) {
    return {
      ready: false,
      source: 'unavailable'
    };
  }

  reloadModel();

  return {
    ready: true,
    source: 'trained'
  };
}
