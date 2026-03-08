import fs from 'fs';
import { USAGE_MODEL_PATH } from './model-paths';

let model: any = null;

export type AnomalySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface UsageAnomalyResult {
  isAnomaly: boolean;
  severity: AnomalySeverity;
  threshold: number;
  multiplier: number;
}

export function loadModel() {
  if (!model) {
    if (!fs.existsSync(USAGE_MODEL_PATH)) {
      model = { threshold: Infinity };
      return model;
    }

    const data = fs.readFileSync(USAGE_MODEL_PATH, 'utf-8');

    model = JSON.parse(data);
    console.log("ML Model Loaded:", model);
  }
  return model;
}

export function resetUsageModelCache() {
  model = null;
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
