import fs from 'fs';

const MODEL_PATH = 'models/usage-model.json';
let model: any = null;

export function loadModel() {
  if (!model) {
    const data =
      fs.readFileSync(MODEL_PATH, 'utf-8');

    model = JSON.parse(data);
    console.log("ML Model Loaded:", model);
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