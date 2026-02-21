// import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { logMetric } from '../services/metrics.service';
import { recordRequest } from '../services/usage-tracker';
import { isAnomaly } from '../ml/detect-anomaly';

const credentials: Record<string, { apiKey: string, target: string }> = {
    'openai': {
        apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
        target: 'https://api.openai.com'
    },
    'anthropic': {
        apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-placeholder',
        target: 'https://api.anthropic.com'
    },
    'stripe': {
        apiKey: process.env.STRIPE_API_KEY || 'sk_test_placeholder',
        target: 'https://api.stripe.com'
    }
};

export const setupProxy = (app: any) => {
    Object.entries(credentials).forEach(([service, config]) => {
        const proxyOptions: Options = {
            target: config.target,
            changeOrigin: true,
            pathRewrite: {
                [`^/proxy/${service}`]: '',
            },
            on: {
                proxyReq: (proxyReq, req, res) => {
                    const currentUsage = recordRequest(service);

                    if (isAnomaly(currentUsage)) {
                        console.warn(`[${service}] Anomaly detected: ${currentUsage} requests in the current minute.`);
                        (res as any).status(429).json({
                            error: "Anomaly detected",
                            message: "Request blocked due to abnormal usage", currentUsage
                        });
                        proxyReq.destroy();
                        return;
                    }

                    if (service === 'openai' || service === 'anthropic') {
                        proxyReq.setHeader('Authorization', `Bearer ${config.apiKey}`);
                    } else if (service === 'stripe') {
                        proxyReq.setHeader('Authorization', `Bearer ${config.apiKey}`);
                    }

                    (req as any)._startTime = Date.now();
                },
                proxyRes: (proxyRes, req, res) => {
                    const duration = Date.now() - (req as any)._startTime;
                    const statusCode = proxyRes.statusCode || 0;

                    logMetric({
                        service,
                        endpoint: req.url || '/',
                        method: req.method || 'GET',
                        statusCode,
                        latencyMs: duration,
                        timestamp: new Date().toISOString()
                    });
                },
                error: (err, req, res) => {
                    const duration = Date.now() - (req as any)._startTime;
                    console.error(`[${service}] Proxy Error:`, err.message);

                    logMetric({
                        service,
                        endpoint: req.url || '/',
                        method: req.method || 'GET',
                        statusCode: 502,
                        latencyMs: duration,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        };

        app.use(`/proxy/${service}`, createProxyMiddleware(proxyOptions));
    });
};
