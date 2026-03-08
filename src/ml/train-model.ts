import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

import { groupByMinute } from './usage-analyzer';
import { trainUsageModel } from './forecasting';
import { USAGE_MODEL_PATH } from './model-paths';

const prisma = new PrismaClient();

export async function trainUsageBaseline() {

  console.log("Fetching metrics...");

  const metrics =
    await prisma.apiMetric.findMany({
      orderBy: { timestamp: 'asc' }
    });

  if(metrics.length === 0) {
    console.log("No data found.");
    return null;
  }

  console.log("Analyzing usage...");

  const timeSeries =
    groupByMinute(metrics);

  console.log("Training model...");

  const model =
    trainUsageModel(timeSeries);

  console.log("Saving model...");

  fs.mkdirSync(path.dirname(USAGE_MODEL_PATH), { recursive: true });

  fs.writeFileSync(
    USAGE_MODEL_PATH,
    JSON.stringify(model, null, 2)
  );

  console.log("Model trained successfully:");
  console.log(model);

  return model;
}

if (require.main === module) {
  trainUsageBaseline().catch((error) => {
    console.error('Usage model training failed:', error);
    process.exitCode = 1;
  });
}
