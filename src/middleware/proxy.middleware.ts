import type { ClientRequest } from 'http';
import { NextFunction, Request, Response } from 'express';
import {
    createProxyMiddleware,
    fixRequestBody,
    responseInterceptor,
    type Options
} from 'http-proxy-middleware';
import { logMetric, type ApiMetric } from '../services/metrics.service';
import { anomalyDetector } from '../services/anomaly.service';
import {
    controlEngine,
    type ControlDecision,
    type ControlDecisionInput
} from '../services/control-engine.service';
import { recordRequest } from '../services/usage-tracker';
import {
    PROVIDER_SERVICES,
    classifyRequest,
    prepareUpstreamRequest,
    type PreparedUpstreamRequest,
    type ProviderService
} from '../providers/provider-routing';

type ControlledRequest = Request & {
    _startTime?: number;
    _controlDecision?: ControlDecision;
    _upstreamRequest?: PreparedUpstreamRequest;
};

interface ProxyDependencies {
    controlEngine?: {
        evaluate(input: ControlDecisionInput): Promise<ControlDecision>;
    };
    anomalyDetector?: {
        detectAnomaly(input: {
            service: string;
            endpoint: string;
            method: string;
            latencyMs: number;
            statusCode: number;
            requestSize?: number;
            responseSize?: number;
            timestamp?: Date | string | number;
        }): Promise<{ isAnomaly: boolean; score: number }>;
    };
    logMetric?: (metric: ApiMetric) => Promise<unknown> | unknown;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CONTROL_ENGINE_ERROR_RESPONSE = {
    error: 'SaaS-Sentinel could not evaluate this request.'
};

const DEFAULT_POLICY_ERROR = 'Request blocked by SaaS-Sentinel policy.';

function buildFallbackDecision(service: ProviderService, req: Request): ControlDecision {
    return {
        service,
        routedService: service,
        endpoint: req.url || '/',
        method: req.method || 'GET',
        isAnomaly: false,
        reason: 'NONE',
        severity: 'NONE',
        throttleMs: 0,
        actions: [],
        currentUsage: 0,
        anomalyThreshold: Infinity,
        anomalyMultiplier: 0,
        modifiedBody: req.body
    };
}

function getStructuredBlockResponse(decision: ControlDecision) {
    return {
        error: DEFAULT_POLICY_ERROR,
        reason: decision.reason,
        actions: decision.actions
    };
}

function applyUpstreamHeaders(proxyReq: ClientRequest, headers: Record<string, string>) {
    const removableHeaders = [
        'authorization',
        'x-api-key',
        'anthropic-version',
        'content-length'
    ];

    for (const header of removableHeaders) {
        proxyReq.removeHeader(header);
    }

    for (const [key, value] of Object.entries(headers)) {
        proxyReq.setHeader(key, value);
    }
}

function setResponseHeaders(
    res: { setHeader(name: string, value: string): unknown },
    headers?: Record<string, string>
) {
    if (!headers) {
        return;
    }

    for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
    }
}

function getRequestSize(req: { headers: Request['headers']; body?: unknown }) {
    const contentLength = req.headers['content-length'];
    const headerValue = Array.isArray(contentLength) ? contentLength[0] : contentLength;
    const parsedHeader = Number(headerValue);

    if (Number.isFinite(parsedHeader) && parsedHeader >= 0) {
        return parsedHeader;
    }

    if (Buffer.isBuffer(req.body)) {
        return req.body.length;
    }

    if (typeof req.body === 'string') {
        return Buffer.byteLength(req.body);
    }

    if (req.body && typeof req.body === 'object') {
        try {
            return Buffer.byteLength(JSON.stringify(req.body));
        } catch {
            return 0;
        }
    }

    return 0;
}

function getResponseSize(body: Buffer | string) {
    if (Buffer.isBuffer(body)) {
        return body.length;
    }

    if (typeof body === 'string') {
        return Buffer.byteLength(body);
    }

    return 0;
}

const buildControlMiddleware = (
    service: ProviderService,
    dependencies: Required<ProxyDependencies>
) =>
    async (req: Request, res: Response, next: NextFunction) => {
        const controlledReq = req as ControlledRequest;
        controlledReq._startTime = Date.now();

        try {
            const currentUsage = recordRequest(service);
            const classification = classifyRequest(
                service,
                req.method || 'GET',
                req.url || '/',
                req.body
            );

            const decision = await dependencies.controlEngine.evaluate({
                service,
                endpoint: req.url || '/',
                method: req.method || 'GET',
                currentUsage,
                requestBody: req.body,
                requestKind: classification.requestKind,
                rerouteEligible: classification.rerouteEligible,
                availableServices: PROVIDER_SERVICES
            });

            controlledReq._controlDecision = decision;

            if (decision.actions.includes('BLOCK')) {
                const blockPayload = getStructuredBlockResponse(decision);
                const blockBody = JSON.stringify(blockPayload);

                await dependencies.logMetric({
                    service,
                    endpoint: req.url || '/',
                    method: req.method || 'GET',
                    statusCode: 403,
                    latencyMs: Date.now() - (controlledReq._startTime || Date.now()),
                    timestamp: new Date().toISOString(),
                    cost: 0,
                    requestSize: getRequestSize(req),
                    responseSize: Buffer.byteLength(blockBody),
                    actionTaken: decision.actions.join(',')
                });

                return res.status(403).json(blockPayload);
            }

            controlledReq._upstreamRequest = prepareUpstreamRequest({
                originalService: service,
                routedService: decision.routedService,
                method: req.method || 'GET',
                path: req.url || '/',
                body: decision.modifiedBody,
                headers: req.headers
            });

            if (controlledReq._upstreamRequest.body !== undefined) {
                controlledReq.body = controlledReq._upstreamRequest.body;
            }

            if (decision.actions.length > 0) {
                console.warn(
                    `[${service}] control=${decision.actions.join(',')} reason=${decision.reason} severity=${decision.severity} usage=${currentUsage}`
                );
            }

            if (decision.throttleMs > 0) {
                await sleep(decision.throttleMs);
            }
        } catch (error: any) {
            console.error(`[${service}] Control engine failed:`, error?.message || error);

            try {
                const fallbackDecision = buildFallbackDecision(service, req);
                controlledReq._controlDecision = fallbackDecision;
                controlledReq._upstreamRequest = prepareUpstreamRequest({
                    originalService: service,
                    routedService: service,
                    method: req.method || 'GET',
                    path: req.url || '/',
                    body: req.body,
                    headers: req.headers
                });
            } catch (fallbackError: any) {
                console.error(`[${service}] Proxy preparation failed:`, fallbackError?.message || fallbackError);
                return res.status(502).json(CONTROL_ENGINE_ERROR_RESPONSE);
            }
        }

        next();
    };

export const createControlMiddleware = buildControlMiddleware;

export const setupProxy = (app: any, dependencies: ProxyDependencies = {}) => {
    const resolvedDependencies: Required<ProxyDependencies> = {
        controlEngine: dependencies.controlEngine || controlEngine,
        anomalyDetector: dependencies.anomalyDetector || anomalyDetector,
        logMetric: dependencies.logMetric || logMetric
    };

    PROVIDER_SERVICES.forEach((service) => {
        const proxyOptions: Options = {
            target: 'http://localhost',
            changeOrigin: true,
            selfHandleResponse: true,
            router: (req) => {
                const controlledReq = req as ControlledRequest;
                return controlledReq._upstreamRequest?.target;
            },
            pathRewrite: (_, req) => {
                const controlledReq = req as ControlledRequest;
                return controlledReq._upstreamRequest?.path || req.url || '/';
            },
            on: {
                proxyReq: (proxyReq, req) => {
                    const controlledReq = req as ControlledRequest;
                    const upstreamRequest = controlledReq._upstreamRequest;

                    if (!upstreamRequest) {
                        return;
                    }

                    applyUpstreamHeaders(proxyReq, upstreamRequest.headers);
                    fixRequestBody(proxyReq, req);
                },
                proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
                    const controlledReq = req as ControlledRequest;
                    const upstreamRequest = controlledReq._upstreamRequest;
                    const endpoint = req.url || '/';
                    const method = req.method || 'GET';
                    const routedService = controlledReq._controlDecision?.routedService || service;
                    const duration = Date.now() - (controlledReq._startTime || Date.now());
                    const requestSize = getRequestSize(req);
                    let statusCode = proxyRes.statusCode || 200;
                    let responseBody: Buffer | string = responseBuffer;

                    if (upstreamRequest?.responseTransformer) {
                        const transformed = upstreamRequest.responseTransformer({
                            body: responseBuffer,
                            headers: proxyRes.headers,
                            statusCode
                        });

                        if (typeof transformed.statusCode === 'number') {
                            statusCode = transformed.statusCode;
                            res.statusCode = transformed.statusCode;
                        }

                        setResponseHeaders(res, transformed.headers);
                        responseBody = transformed.body;
                    }

                    const responseSize = getResponseSize(responseBody);
                    const { isAnomaly, score } = await resolvedDependencies.anomalyDetector.detectAnomaly({
                        service: routedService,
                        endpoint,
                        method,
                        latencyMs: duration,
                        statusCode,
                        requestSize,
                        responseSize,
                        timestamp: new Date()
                    });

                    if (isAnomaly) {
                        console.warn(
                            `🚨 [ANOMALY] Detected abnormal behavior on ${routedService}: Score=${score.toFixed(3)} | Latency=${duration}ms | Payload=${method} ${endpoint}`
                        );
                    }

                    await resolvedDependencies.logMetric({
                        service: routedService,
                        endpoint,
                        method,
                        statusCode,
                        latencyMs: duration,
                        timestamp: new Date().toISOString(),
                        requestSize,
                        responseSize,
                        actionTaken: controlledReq._controlDecision?.actions.join(',') || undefined
                    });

                    return responseBody;
                }),
                error: async (err, req, res) => {
                    const controlledReq = req as ControlledRequest;
                    const duration = Date.now() - (controlledReq._startTime || Date.now());
                    const routedService = controlledReq._controlDecision?.routedService || service;
                    const serverResponse = res as Response;

                    console.error(`[${service}] Proxy Error:`, err.message);

                    const errorBody = JSON.stringify({
                        error: 'Upstream request failed.'
                    });

                    await resolvedDependencies.logMetric({
                        service: routedService,
                        endpoint: req.url || '/',
                        method: req.method || 'GET',
                        statusCode: 502,
                        latencyMs: duration,
                        timestamp: new Date().toISOString(),
                        requestSize: getRequestSize(req),
                        responseSize: Buffer.byteLength(errorBody),
                        actionTaken: controlledReq._controlDecision?.actions.join(',') || undefined
                    });

                    if (!serverResponse.headersSent) {
                        serverResponse.writeHead(502, { 'content-type': 'application/json' });
                    }

                    serverResponse.end(
                        errorBody
                    );
                }
            }
        };

        app.use(
            `/proxy/${service}`,
            createControlMiddleware(service, resolvedDependencies),
            createProxyMiddleware(proxyOptions)
        );
    });
};
