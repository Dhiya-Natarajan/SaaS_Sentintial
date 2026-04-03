// @ts-ignore
import { IsolationForest } from 'ml-isolation-forest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { ISOLATION_FOREST_MODEL_PATH } from '../ml/model-paths';

dotenv.config({ quiet: true });

class SimpleScaler {
    private mins: number[] = [];
    private maxs: number[] = [];

    fit(data: number[][]) {
        if (data.length === 0) return;
        const numFeatures = data[0].length;
        this.mins = new Array(numFeatures).fill(Infinity);
        this.maxs = new Array(numFeatures).fill(-Infinity);

        for (const row of data) {
            for (let i = 0; i < numFeatures; i++) {
                if (row[i] < this.mins[i]) this.mins[i] = row[i];
                if (row[i] > this.maxs[i]) this.maxs[i] = row[i];
            }
        }
    }

    transform(data: number[][]): number[][] {
        if (this.mins.length === 0) return data;
        return data.map(row =>
            row.map((val, i) => {
                const range = this.maxs[i] - this.mins[i];
                return range === 0 ? 0 : (val - this.mins[i]) / range;
            })
        );
    }

    fromJSON(json: any) {
        if (json && json.mins && json.maxs) {
            this.mins = json.mins;
            this.maxs = json.maxs;
        }
    }

    toJSON() {
        return { mins: this.mins, maxs: this.maxs };
    }
}

interface BaselineMetric {
    latencyMs: number;
    statusCode: number;
    method: string;
    service: string;
    endpoint: string;
    timestamp: Date;
    requestSize: number;
    responseSize: number;
    actionTaken: string | null;
}

interface PersistedIsolationForestModel {
    featureVersion?: number;
    trainSize?: number;
    threshold?: number;
    contamination?: number;
    scaler?: ReturnType<SimpleScaler['toJSON']>;
    forest?: any[];
    scoreSummary?: ScoreSummary;
}

interface ScoreSummary {
    min: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    max: number;
}

interface DetectionInput {
    service: string;
    endpoint: string;
    method: string;
    latencyMs: number;
    statusCode: number;
    requestSize?: number;
    responseSize?: number;
    timestamp?: Date | string | number;
}

export class AnomalyDetectionService {
    private forest: any | null = null;
    private isTrained: boolean = false;
    private scaler: SimpleScaler = new SimpleScaler();
    private featureVersion: number = 2;
    private threshold: number = 0.6; // Default fallback
    private contamination: number = 0.05; // 5% expected anomalies
    private modelPath = ISOLATION_FOREST_MODEL_PATH;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        await this.loadModel();
        this.scheduleRetraining();
    }

    private async loadModel() {
        try {
            if (fs.existsSync(this.modelPath)) {
                console.log('Loading persisted Isolation Forest model...');
                const modelData = JSON.parse(
                    fs.readFileSync(this.modelPath, 'utf8')
                ) as PersistedIsolationForestModel;

                if (modelData.forest && modelData.scaler) {
                    this.scaler.fromJSON(modelData.scaler);
                    this.featureVersion = modelData.featureVersion ?? 1;
                    if (
                        typeof modelData.contamination === 'number' &&
                        Number.isFinite(modelData.contamination) &&
                        modelData.contamination > 0 &&
                        modelData.contamination < 1
                    ) {
                        this.contamination = modelData.contamination;
                    }

                    const savedThreshold = this.getFiniteNumber(modelData.threshold);
                    const thresholdFloor = this.getConfiguredThresholdFloor();
                    this.threshold = this.resolveEffectiveThreshold(savedThreshold, thresholdFloor);
                    this.forest = this.reconstructForest(
                        modelData.forest,
                        modelData.trainSize ?? 1
                    );
                    this.isTrained = true;
                    console.log(
                        `Model loaded successfully (featureVersion=${this.featureVersion} saved=${this.formatThreshold(savedThreshold)} floor=${this.formatThreshold(thresholdFloor)} effective=${this.threshold.toFixed(4)})`
                    );

                    if (modelData.scoreSummary) {
                        console.log('Isolation Forest score summary:', modelData.scoreSummary);
                    }

                    return;
                }
            }

            console.log('⚠️ No valid persisted model found. Training baseline...');
            await this.trainBaseline();
        } catch (error) {
            console.error('❌ Error loading model:', error);
            await this.trainBaseline();
        }
    }

    /**
     * Reconstruct the Isolation Forest from serialized data.
     * Since TreeNode instances are not exported, we extract the prototype from a dummy instance.
     */
    private reconstructForest(serializedForest: any[], trainSize: number) {
        const dummyForest = new IsolationForest({ nEstimators: 1 });
        dummyForest.train([[0, 0, 0, 0]]);
        const TreeNodeProto = Object.getPrototypeOf(dummyForest.forest[0]);

        const fixNode = (node: any) => {
            if (!node) return;
            Object.setPrototypeOf(node, TreeNodeProto);
            if (node.left) fixNode(node.left);
            if (node.right) fixNode(node.right);
        };

        serializedForest.forEach(fixNode);

        const forest = new IsolationForest({ nEstimators: serializedForest.length });
        forest.forest = serializedForest;
        // @ts-ignore - Isolation Forest uses trainingSet.length in prediction
        forest.trainingSet = { length: trainSize };
        return forest;
    }

    /**
     * Train an Isolation Forest model using historical metrics.
     */
    public async trainBaseline() {
        console.log('🚀 Training Isolation Forest Baseline...');

        const metricsRecs = await prisma.apiMetric.findMany({
            take: 5000,
            orderBy: { timestamp: 'desc' },
            select: {
                latencyMs: true,
                statusCode: true,
                method: true,
                service: true,
                endpoint: true,
                timestamp: true,
                requestSize: true,
                responseSize: true,
                actionTaken: true
            }
        });

        if (metricsRecs.length < 50) {
            console.warn('⚠️ Not enough data to train Isolation Forest. Need at least 50 records.');
            return false;
        }

        const trainingMetrics = this.selectTrainingMetrics(metricsRecs);
        this.featureVersion = 2;

        if (trainingMetrics.length < 50) {
            console.warn('⚠️ Not enough baseline-quality data to train Isolation Forest. Need at least 50 records.');
            return false;
        }

        const rawData = trainingMetrics.map((metric) =>
            this.createFeatureVector(metric, this.featureVersion)
        );

        // 1. Feature Normalization
        this.scaler.fit(rawData);
        const scaledData = this.scaler.transform(rawData);

        // 2. Train Forest
        const forest = new IsolationForest({ nEstimators: 100 });
        forest.train(scaledData);

        // 3. Dynamic Threshold Calculation (based on contamination)
        const scores = forest.predict(scaledData);
        const scoreSummary = this.summarizeScores(scores);
        const savedThreshold = this.calculateThreshold(scores);
        const thresholdFloor = this.getConfiguredThresholdFloor();
        this.threshold = this.resolveEffectiveThreshold(savedThreshold, thresholdFloor);

        this.forest = forest;
        this.isTrained = true;

        // 4. Persistence
        const dir = path.dirname(this.modelPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(this.modelPath, JSON.stringify({
            trainedAt: new Date().toISOString(),
            featureVersion: this.featureVersion,
            trainSize: scaledData.length,
            threshold: savedThreshold,
            contamination: this.contamination,
            scoreSummary,
            scaler: this.scaler.toJSON(),
            forest: forest.forest // Serialize the trees
        }));

        console.log(
            `✅ Training complete. Thresholds: saved=${savedThreshold.toFixed(4)} floor=${this.formatThreshold(thresholdFloor)} effective=${this.threshold.toFixed(4)} (${scaledData.length} records).`
        );
        console.log('Isolation Forest training summary:', {
            contamination: this.contamination,
            scoreSummary
        });
        return true;
    }

    private scheduleRetraining() {
        // Daily retraining
        const timer = setInterval(() => this.trainBaseline(), 24 * 60 * 60 * 1000);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    public async detectAnomaly(input: DetectionInput): Promise<{ isAnomaly: boolean; score: number }> {
        if (!this.forest || !this.isTrained) return { isAnomaly: false, score: 0 };

        const rawInput = this.createFeatureVector({
            ...input,
            timestamp: input.timestamp ? new Date(input.timestamp) : new Date()
        }, this.featureVersion);
        const scaledInput = this.scaler.transform([rawInput])[0];

        const results = this.forest.predict([scaledInput]);
        const score = results[0];

        return {
            isAnomaly: score > this.threshold,
            score
        };
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 1000;
    }

    private createFeatureVector(metric: {
        latencyMs: number;
        statusCode: number;
        method: string;
        service: string;
        endpoint: string;
        timestamp?: Date | string | number;
        requestSize?: number;
        responseSize?: number;
    }, featureVersion: number) {
        if (featureVersion <= 1) {
            return [
                metric.latencyMs,
                metric.statusCode,
                this.hashString(metric.method),
                this.hashString(metric.service + metric.endpoint)
            ];
        }

        const timestamp = metric.timestamp ? new Date(metric.timestamp) : new Date();
        const hourAngle =
            (((timestamp.getUTCHours() * 60) + timestamp.getUTCMinutes()) / (24 * 60)) * Math.PI * 2;
        const weekdayAngle = (timestamp.getUTCDay() / 7) * Math.PI * 2;

        return [
            Math.log1p(Math.max(metric.latencyMs, 0)),
            metric.statusCode,
            this.hashString(metric.method),
            this.hashString(metric.service),
            this.hashString(metric.endpoint),
            Math.log1p(Math.max(metric.requestSize ?? 0, 0)),
            Math.log1p(Math.max(metric.responseSize ?? 0, 0)),
            Math.sin(hourAngle),
            Math.cos(hourAngle),
            Math.sin(weekdayAngle),
            Math.cos(weekdayAngle)
        ];
    }

    private selectTrainingMetrics(metrics: BaselineMetric[]) {
        const cleanBaseline = metrics.filter((metric) => this.isBaselineMetric(metric));

        if (cleanBaseline.length < 50) {
            console.warn('⚠️ Baseline filtering left too few records. Falling back to recent raw metrics.');
            return metrics.slice(0, 2000);
        }

        const serviceCount = new Set(cleanBaseline.map((metric) => metric.service)).size || 1;
        const perServiceLimit = Math.max(100, Math.ceil(2000 / serviceCount));
        const grouped = new Map<string, BaselineMetric[]>();

        for (const metric of cleanBaseline) {
            const existing = grouped.get(metric.service) || [];
            if (existing.length < perServiceLimit) {
                existing.push(metric);
                grouped.set(metric.service, existing);
            }
        }

        return Array.from(grouped.values())
            .flat()
            .slice(0, 2000);
    }

    private isBaselineMetric(metric: BaselineMetric) {
        if (!Number.isFinite(metric.latencyMs) || metric.latencyMs < 0) {
            return false;
        }

        if (metric.statusCode >= 500) {
            return false;
        }

        return !this.hasControlAction(metric.actionTaken);
    }

    private hasControlAction(actionTaken: string | null) {
        return typeof actionTaken === 'string' && actionTaken.trim().length > 0;
    }

    private calculateThreshold(scores: number[]) {
        const sortedScores = [...scores].sort((a, b) => a - b);
        const quantileIndex = Math.min(
            sortedScores.length - 1,
            Math.max(0, Math.ceil(sortedScores.length * (1 - this.contamination)) - 1)
        );
        return sortedScores[quantileIndex];
    }

    private summarizeScores(scores: number[]): ScoreSummary {
        const sorted = [...scores].sort((a, b) => a - b);

        return {
            min: sorted[0],
            p25: this.percentile(sorted, 0.25),
            p50: this.percentile(sorted, 0.5),
            p75: this.percentile(sorted, 0.75),
            p90: this.percentile(sorted, 0.9),
            p95: this.percentile(sorted, 0.95),
            max: sorted[sorted.length - 1]
        };
    }

    private percentile(sortedValues: number[], ratio: number) {
        const index = Math.min(
            sortedValues.length - 1,
            Math.max(0, Math.floor((sortedValues.length - 1) * ratio))
        );
        return sortedValues[index];
    }

    private getConfiguredThresholdFloor() {
        return this.getFiniteNumber(process.env.IFOREST_THRESHOLD_FLOOR);
    }

    private resolveEffectiveThreshold(
        savedThreshold: number | null,
        thresholdFloor: number | null
    ) {
        const baselineThreshold = savedThreshold ?? this.threshold;

        if (thresholdFloor === null) {
            return baselineThreshold;
        }

        return Math.max(baselineThreshold, thresholdFloor);
    }

    private getFiniteNumber(value: unknown) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private formatThreshold(value: number | null) {
        return value === null ? 'none' : value.toFixed(4);
    }
}

export const anomalyDetector = new AnomalyDetectionService();
