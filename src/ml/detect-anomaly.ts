import fs from 'fs';
import { USAGE_MODEL_PATH } from './model-paths';

interface UsageModel {
  threshold?: number;
  [key: string]: unknown;
}

let model: UsageModel | null = null;
let modelMtimeMs: number | null = null;

export type AnomalySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface UsageAnomalyResult {
  isAnomaly: boolean;
  severity: AnomalySeverity;
  threshold: number;
  multiplier: number;
}

export function loadModel(): UsageModel {
  const currentMtimeMs = getUsageModelMtime();

  if (!currentMtimeMs) {
    model = { threshold: Infinity };
    modelMtimeMs = null;
    return model;
  }

  if (model && modelMtimeMs === currentMtimeMs) {
    return model;
  }

  try {
    const data = fs.readFileSync(USAGE_MODEL_PATH, 'utf-8');
    model = JSON.parse(data);
    modelMtimeMs = currentMtimeMs;
    console.log('ML Model Loaded:', model);
  } catch (error) {
    if (model) {
      console.warn('Failed to reload updated usage model. Continuing with cached model.', error);
      return model;
    }

    model = { threshold: Infinity };
    modelMtimeMs = currentMtimeMs;
  }

  if (!model) {
    model = { threshold: Infinity };
  }

  return model;
}

export function resetUsageModelCache() {
  model = null;
  modelMtimeMs = null;
}

export function reloadUsageModel() {
  resetUsageModelCache();
  return loadModel();
}

export function isAnomaly(currentRequests: number) {
  return detectUsageAnomaly(currentRequests).isAnomaly;
}

export function detectUsageAnomaly(currentRequests: number): UsageAnomalyResult {
  const loadedModel = loadModel();
  const threshold = Number(loadedModel.threshold || Infinity);
  const multiplier = threshold > 0 ? currentRequests / threshold : 0;
  const severity = calculateSeverity(multiplier);

  return {
    isAnomaly: severity !== 'NONE',
    severity,
    threshold,
    multiplier
  };
}

function calculateSeverity(multiplier: number): AnomalySeverity {
  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    return 'NONE';
  }

  if (multiplier < 1.5) {
    return 'LOW';
  }

  if (multiplier < 2) {
    return 'MEDIUM';
  }

  return 'HIGH';
}

function getUsageModelMtime() {
  if (!fs.existsSync(USAGE_MODEL_PATH)) {
    return null;
  }

  return fs.statSync(USAGE_MODEL_PATH).mtimeMs;
}
