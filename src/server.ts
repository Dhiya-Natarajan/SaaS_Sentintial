import express from 'express';
import dotenv from 'dotenv';
import { setupProxy } from './middleware/proxy.middleware';
import { getStats } from './services/metrics.service';
import { anomalyDetector } from './services/anomaly.service';
import { controlEngine } from './services/control-engine.service';
import { AnomalySeverity, reloadUsageModel } from './ml/detect-anomaly';
import { trainUsageBaseline } from './ml/train-model';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const VALID_SEVERITIES: AnomalySeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'SaaS-Sentinel is active',
        monitoredServices: ['openai', 'anthropic', 'stripe']
    });
});

// View Real-time Metrics (DB version)
app.get('/metrics', async (req, res) => {
    try {
        const stats = await getStats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// View enforcement logs from the control engine
app.get('/enforcements', async (req, res) => {
    try {
        const limit = Number(req.query.limit || 50);
        const service = typeof req.query.service === 'string' ? req.query.service : undefined;
        const rawSeverity = typeof req.query.severity === 'string'
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

// Admin endpoint to retrain the ML model
app.post('/ml/retrain', async (req, res) => {
    try {
        const [usageModel, anomalyModelTrained] = await Promise.all([
            trainUsageBaseline(),
            anomalyDetector.trainBaseline()
        ]);

        if (usageModel) {
            reloadUsageModel();
        }

        res.json({
            message: 'ML model retraining completed.',
            usageModelTrained: Boolean(usageModel),
            responseAnomalyModelTrained: anomalyModelTrained
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize Proxy Layer
setupProxy(app);

app.listen(PORT, () => {
    console.log(`
  SaaS-Sentinel Proxy Active
  Listening on http://localhost:${PORT}
  Available Proxies:
    - OpenAI:    http://localhost:${PORT}/proxy/openai
    - Anthropic: http://localhost:${PORT}/proxy/anthropic
    - Stripe:    http://localhost:${PORT}/proxy/stripe

  Metrics Dashboard: http://localhost:${PORT}/metrics
  `);
});
