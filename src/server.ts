import express from 'express';
import dotenv from 'dotenv';
import { setupProxy } from './middleware/proxy.middleware';
import { getStats } from './services/metrics.service';
import { anomalyDetector } from './services/anomaly.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Admin endpoint to retrain the ML model
app.post('/ml/retrain', async (req, res) => {
    try {
        await anomalyDetector.trainBaseline();
        res.json({ message: 'ML model training triggered successfully.' });
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
