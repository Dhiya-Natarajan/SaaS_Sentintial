import path from 'path';

const ML_MODELS_DIR = path.join(process.cwd(), 'ml_models');

export const USAGE_MODEL_PATH = path.join(ML_MODELS_DIR, 'usage-model.json');
export const ISOLATION_FOREST_MODEL_PATH = path.join(
  ML_MODELS_DIR,
  'isolation_forest_v1.json'
);
