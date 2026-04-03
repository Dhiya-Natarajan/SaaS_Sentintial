import fs from 'fs';

const MODEL_PATH = 'ml_models/usage-model.json';
let model: any = { threshold: 50 }; // Default threshold

export function loadModel() {
  if (model === null || model.threshold === 50) {
    if (fs.existsSync(MODEL_PATH)) {
      try {
        const data = fs.readFileSync(MODEL_PATH, 'utf-8');
        model = JSON.parse(data);
        console.log("ML Model Loaded:", model);
      } catch (e) {
        console.error("Error loading ML model:", (e as Error).message);
      }
    } else {
      console.warn(`⚠️ ML Model file ${MODEL_PATH} not found. Using default threshold: ${model.threshold}`);
    }
  }
  return model;
}

export function isAnomaly(currentRequests: number) {
  const model = loadModel();
  if (currentRequests > model.threshold) {
    return true;
  }
  return false;
}