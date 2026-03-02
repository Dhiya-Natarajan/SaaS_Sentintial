import { PrismaClient } from '@prisma/client';
import fs from 'fs';

import { groupByMinute } from './usage-analyzer';
import { trainUsageModel } from './forecasting';

const prisma = new PrismaClient();

async function train() {

  console.log("Fetching metrics...");

  const metrics =
    await prisma.apiMetric.findMany({
      orderBy: { timestamp: 'asc' }
    });

  if(metrics.length === 0) {
    console.log("No data found.");
    return;
  }

  console.log("Analyzing usage...");

  const timeSeries =
    groupByMinute(metrics);

  console.log("Training model...");

  const model =
    trainUsageModel(timeSeries);

  console.log("Saving model...");

  fs.writeFileSync(
    'models/usage-model.json',
    JSON.stringify(model, null, 2)
  );

  console.log("Model trained successfully:");
  console.log(model);
}

train();