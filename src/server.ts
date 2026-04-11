import express from 'express';
import dotenv from 'dotenv';
import { setupProxy } from './middleware/proxy.middleware';
import { getStats } from './services/metrics.service';
import { anomalyDetector } from './services/anomaly.service';
import { controlEngine } from './services/control-engine.service';
import { AnomalySeverity, reloadUsageModel } from './ml/detect-anomaly';
import { trainUsageBaseline } from './ml/train-model';
import { buildRetrainStatus } from './ml/retrain-status';
import { ensureUsageModelReady } from './ml/usage-model-bootstrap';
import { getSummary, getTrend, getServiceBreakdown, getAnomalies } from './services/cost-analytics.service';
import { predictCost } from './services/forecast.service'

dotenv.config();

const app = express();
const PORT = 3001;
const VALID_SEVERITIES: AnomalySeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
let usageModelStatus: 'existing' | 'trained' | 'unavailable' = 'unavailable';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'SaaS-Sentinel is active',
    monitoredServices: ['openai', 'anthropic', 'stripe'],
    usageModelStatus
  });
});

app.get('/metrics', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/enforcements', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);

    const service =
      typeof req.query.service === 'string'
        ? req.query.service
        : undefined;

    const rawSeverity =
      typeof req.query.severity === 'string'
        ? req.query.severity.toUpperCase()
        : undefined;

    if (rawSeverity && !VALID_SEVERITIES.includes(rawSeverity as AnomalySeverity)) {
      return res.status(400).json({
        error: `Invalid severity. Allowed values: ${VALID_SEVERITIES.join(', ')}`
      });
    }

    const severity = rawSeverity as AnomalySeverity | undefined;

    const logs = await controlEngine.getEnforcementLogs({
      limit: Number.isFinite(limit) ? limit : 50,
      service,
      severity
    });

    res.json({
      count: logs.length,
      logs
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ml/retrain', async (req, res) => {
  try {

    const [usageModel, anomalyModelTrained] = await Promise.all([
      trainUsageBaseline(),
      anomalyDetector.trainBaseline()
    ]);

    if (usageModel) {
      reloadUsageModel();
    }

    const retrainStatus = buildRetrainStatus(
      Boolean(usageModel),
      anomalyModelTrained
    );

    res.json({
      status: retrainStatus.status,
      message: retrainStatus.message,
      usageModelTrained: Boolean(usageModel),
      responseAnomalyModelTrained: anomalyModelTrained
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/analytics/summary', async (req, res) => {
  try {
    const data = await getSummary();
    res.json(data);
  } catch (error) {
    console.error('Summary analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

app.get('/analytics/trend', async (req, res) => {
  try {
    const data = await getTrend();
    res.json(data);
  } catch (error) {
    console.error('Trend analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

app.get('/analytics/service-breakdown', async (req, res) => {
  try {
    const data = await getServiceBreakdown();
    res.json(data);
  } catch (error) {
    console.error('Service breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

app.get('/analytics/anomalies', async (req, res) => {
  try {
    const data = await getAnomalies();
    res.json(data);
  } catch (error) {
    console.error('Anomaly analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

app.get('/analytics/predictions', async (req, res) => {
  try {
    const prediction = await predictCost()
    res.json(prediction)
  } catch (error) {
    console.error("Prediction error:", error)
    res.status(500).json({
      error: "Failed to generate predictions"
    })
  }
})

setupProxy(app);

async function startServer() {
  const usageModel = await ensureUsageModelReady();
  usageModelStatus = usageModel.source;
  if (!usageModel.ready) {
    console.warn(
      'Usage model is unavailable. Control-engine mitigations remain disabled until metrics exist and the model is trained.'
    );
  }
  app.listen(PORT, () => {
    console.log(`
  SaaS-Sentinel Proxy Active

  Listening on http://localhost:${PORT}

  Available Proxies:
    - OpenAI:    http://localhost:${PORT}/proxy/openai
    - Anthropic: http://localhost:${PORT}/proxy/anthropic
    - Stripe:    http://localhost:${PORT}/proxy/stripe

  Metrics Dashboard: http://localhost:${PORT}/metrics

  Analytics:
    - Summary:            http://localhost:${PORT}/analytics/summary
    - Trend:              http://localhost:${PORT}/analytics/trend
    - Service Breakdown:  http://localhost:${PORT}/analytics/service-breakdown
    - Anomalies:          http://localhost:${PORT}/analytics/anomalies

  Usage Model: ${usageModelStatus}
    `);

  });

}

startServer().catch((error) => {
  console.error('Failed to start SaaS-Sentinel:', error);
  process.exitCode = 1;
});