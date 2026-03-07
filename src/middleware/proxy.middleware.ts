import { NextFunction, Request, Response } from 'express';
import {
    createProxyMiddleware,
    fixRequestBody,
    Options
} from 'http-proxy-middleware';
import { logMetric } from '../services/metrics.service';
import { anomalyDetector } from '../services/anomaly.service';
import {
    ControlDecision,
    controlEngine
} from '../services/control-engine.service';
import { recordRequest } from '../services/usage-tracker';

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

type ControlledRequest = Request & {
    _startTime?: number;
    _controlDecision?: ControlDecision;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildControlMiddleware = (service: string) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currentUsage = recordRequest(service);
            const decision = await controlEngine.evaluate({
                service,
                endpoint: req.url || '/',
                method: req.method || 'GET',
                currentUsage,
                requestBody: req.body,
                availableServices: Object.keys(credentials)
            });

            const controlledReq = req as ControlledRequest;
            controlledReq._startTime = Date.now();
            controlledReq._controlDecision = decision;

            if (decision.modifiedBody !== undefined) {
                controlledReq.body = decision.modifiedBody;
            }

            if (decision.actions.length > 0) {
                console.warn(
                    `[${service}] control=${decision.actions.join(',')} severity=${decision.severity} usage=${currentUsage}`
                );
            }

            if (decision.throttleMs > 0) {
                await sleep(decision.throttleMs);
            }
        } catch (error: any) {
            console.error(`[${service}] Control engine failed:`, error?.message || error);
        }

        next();
    };

export const setupProxy = (app: any) => {
    Object.entries(credentials).forEach(([service, config]) => {
        const proxyOptions: Options = {
            target: config.target,
            changeOrigin: true,
            router: (req) => {
                const controlledReq = req as ControlledRequest;
                const routedService = controlledReq._controlDecision?.routedService || service;
                return credentials[routedService]?.target || config.target;
            },
            pathRewrite: {
                [`^/proxy/${service}`]: '',
            },
            on: {
                proxyReq: (proxyReq, req, res) => {
                    const controlledReq = req as ControlledRequest;
                    const routedService = controlledReq._controlDecision?.routedService || service;
                    const routedConfig = credentials[routedService] || config;

                    proxyReq.setHeader('Authorization', `Bearer ${routedConfig.apiKey}`);
                    fixRequestBody(proxyReq, req);
                },
                proxyRes: async (proxyRes, req, res) => {
                    const controlledReq = req as ControlledRequest;
                    const duration = Date.now() - (controlledReq._startTime || Date.now());
                    const statusCode = proxyRes.statusCode || 0;
                    const endpoint = req.url || '/';
                    const method = req.method || 'GET';
                    const routedService = controlledReq._controlDecision?.routedService || service;

                    // Real-time Anomaly Detection
                    const { isAnomaly, score } = await anomalyDetector.detectAnomaly(
                        duration,
                        statusCode,
                        method,
                        routedService + endpoint
                    );

                    if (isAnomaly) {
                        console.warn(
                            `🚨 [ANOMALY] Detected abnormal behavior on ${routedService}: Score=${score.toFixed(3)} | Latency=${duration}ms | Payload=${method} ${endpoint}`
                        );
                        // Optionally trigger webhooks or block request
                    }

                    logMetric({
                        service: routedService,
                        endpoint,
                        method,
                        statusCode,
                        latencyMs: duration,
                        timestamp: new Date().toISOString()
                    });
                },
                error: (err, req, res) => {
                    const controlledReq = req as ControlledRequest;
                    const duration = Date.now() - (controlledReq._startTime || Date.now());
                    const routedService = controlledReq._controlDecision?.routedService || service;

                    console.error(`[${service}] Proxy Error:`, err.message);

                    logMetric({
                        service: routedService,
                        endpoint: req.url || '/',
                        method: req.method || 'GET',
                        statusCode: 502,
                        latencyMs: duration,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        };

        app.use(
            `/proxy/${service}`,
            buildControlMiddleware(service),
            createProxyMiddleware(proxyOptions)
        );
    });
};
